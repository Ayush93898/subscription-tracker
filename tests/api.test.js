import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-jwt-secret-not-for-production";
process.env.JWT_EXPIRES = "1h";
process.env.ARCJET_KEY = "ajkey_test";
process.env.QSTASH_URL = "https://qstash.upstash.io";
process.env.QSTASH_TOKEN = "test-only-qstash-token";
process.env.QSTASH_CURRENT_SIGNING_KEY = "test-current-signing-key";
process.env.QSTASH_NEXT_SIGNING_KEY = "test-next-signing-key";
process.env.SERVER_URL = "https://api.example.test";
process.env.EMAIL_PASSWORD = "test-only-email-password";

const [
  { default: express },
  { default: authRouter },
  { default: userRouter },
  { default: subscriptionRouter },
  { default: workflowRouter },
  { default: errorMiddleware },
  { default: User },
  { default: Subscription },
  { workflowClient },
] = await Promise.all([
  import("express"),
  import("../routes/auth.routes.js"),
  import("../routes/user.routes.js"),
  import("../routes/subscription.routes.js"),
  import("../routes/workflow.routes.js"),
  import("../middlewares/error.middleware.js"),
  import("../models/user.model.js"),
  import("../models/subscription.model.js"),
  import("../config/upstash.js"),
]);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/subscriptions", subscriptionRouter);
  app.use("/api/v1/workflows", workflowRouter);
  app.use(errorMiddleware);
  app.get("/", (_req, res) => res.send("welcome to subscription tracker api!"));
  return app;
};

const authenticatedUser = () => ({
  _id: new mongoose.Types.ObjectId(),
  name: "Test User",
  email: "test@example.com",
});

const bearerToken = (userId) =>
  jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });

test("health endpoint returns the welcome text", async () => {
  const response = await request(createApp()).get("/");

  assert.equal(response.status, 200);
  assert.match(response.text, /welcome to subscription tracker api!/);
});

test("protected subscription requests reject a missing token", async () => {
  const response = await request(createApp())
    .post("/api/v1/subscriptions")
    .send({});

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "unauthorized" });
});

test("sign-in returns a JWT for valid credentials", async (t) => {
  const password = "test-password";
  const passwordHash = await bcrypt.hash(password, 4);
  const user = {
    ...authenticatedUser(),
    password: passwordHash,
  };
  t.mock.method(User, "findOne", async () => user);

  const response = await request(createApp())
    .post("/api/v1/auth/sign-in")
    .send({ email: user.email, password });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.id, user._id.toString());
  assert.equal(response.body.data.user.password, undefined);
  assert.equal(
    jwt.verify(response.body.data.token, process.env.JWT_SECRET).userId,
    user._id.toString(),
  );
});

test("sign-in rejects invalid credentials without revealing account existence", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(User, "findOne", async () => null);

  const response = await request(createApp())
    .post("/api/v1/auth/sign-in")
    .send({ email: "missing@example.com", password: "wrong-password" });

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Invalid email or password");
});

test("sign-in maps database failures to the generic error response", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(User, "findOne", async () => {
    throw new Error("database unavailable");
  });

  const response = await request(createApp())
    .post("/api/v1/auth/sign-in")
    .send({ email: "test@example.com", password: "test-password" });

  assert.equal(response.status, 500);
  assert.equal(response.body.error, "database unavailable");
});

test("sign-up commits a transaction and returns a token", async (t) => {
  const user = {
    ...authenticatedUser(),
    password: "hashed-password",
  };
  const session = {
    startTransaction() {},
    async commitTransaction() {},
    async abortTransaction() {},
    endSession() {},
  };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async () => [user]);

  const response = await request(createApp())
    .post("/api/v1/auth/sign-up")
    .send({
      name: user.name,
      email: user.email,
      password: "valid-password",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.data.token, "string");
});

test("user profile lookup excludes password but currently permits another user's ID", async (t) => {
  const caller = authenticatedUser();
  const otherUserId = new mongoose.Types.ObjectId();
  const otherUser = {
    _id: otherUserId,
    name: "Other User",
    email: "other@example.com",
  };
  let lookupCount = 0;
  t.mock.method(User, "findById", (id) => {
    lookupCount += 1;
    if (lookupCount === 1) return Promise.resolve(caller);
    assert.equal(id, otherUserId.toString());
    return { select: async () => otherUser };
  });

  const response = await request(createApp())
    .get(`/api/v1/users/${otherUserId}`)
    .set("Authorization", `Bearer ${bearerToken(caller._id)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.email, otherUser.email);
  assert.equal(response.body.data.password, undefined);
});

test("user listing currently includes password hashes", async (t) => {
  t.mock.method(User, "find", async () => [
    { _id: "user-1", email: "test@example.com", password: "hash-value" },
  ]);

  const response = await request(createApp()).get("/api/v1/users");

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].password, "hash-value");
});

test("subscription validation rejects missing and invalid required fields", async () => {
  const userError = await new User({}).validate().catch((error) => error);
  assert.ok(userError instanceof mongoose.Error.ValidationError);
  assert.ok(userError.errors.name);
  assert.ok(userError.errors.email);
  assert.ok(userError.errors.password);

  const subscriptionError = await new Subscription({
    name: "x",
    price: -1,
    frequency: "fortnightly",
    category: "unknown",
    startDate: new Date(Date.now() + 60_000),
    paymentMethod: "",
    user: new mongoose.Types.ObjectId(),
  })
    .validate()
    .catch((error) => error);

  assert.ok(subscriptionError instanceof mongoose.Error.ValidationError);
  assert.ok(subscriptionError.errors.name);
  assert.ok(subscriptionError.errors.price);
  assert.ok(subscriptionError.errors.frequency);
  assert.ok(subscriptionError.errors.category);
  assert.ok(subscriptionError.errors.startDate);
  assert.ok(subscriptionError.errors.paymentMethod);
});

test("subscription creation triggers QStash after persistence", async (t) => {
  const user = authenticatedUser();
  const subscriptionId = new mongoose.Types.ObjectId();
  let createdInput;
  let workflowInput;
  t.mock.method(User, "findById", async () => user);
  t.mock.method(Subscription, "create", async (input) => {
    createdInput = input;
    return {
      _id: subscriptionId,
      id: subscriptionId.toString(),
      ...input,
    };
  });
  t.mock.method(workflowClient, "trigger", async (input) => {
    workflowInput = input;
    return { workflowRunId: "test-workflow-run" };
  });

  const response = await request(createApp())
    .post("/api/v1/subscriptions")
    .set("Authorization", `Bearer ${bearerToken(user._id)}`)
    .send({
      name: "Premium",
      price: 12.5,
      currency: "USD",
      frequency: "monthly",
      category: "entertainment",
      startDate: new Date().toISOString(),
      paymentMethod: "Card",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.workflowRunId, "test-workflow-run");
  assert.equal(createdInput.user.toString(), user._id.toString());
  assert.equal(
    workflowInput.url,
    "https://api.example.test/api/v1/workflows/subscription/reminder",
  );
});

test("QStash failure returns 500 after the subscription has been created", async (t) => {
  t.mock.method(console, "error", () => {});
  const user = authenticatedUser();
  let persisted = false;
  t.mock.method(User, "findById", async () => user);
  t.mock.method(Subscription, "create", async () => {
    persisted = true;
    return { id: new mongoose.Types.ObjectId().toString() };
  });
  t.mock.method(workflowClient, "trigger", async () => {
    throw new TypeError("fetch failed");
  });

  const response = await request(createApp())
    .post("/api/v1/subscriptions")
    .set("Authorization", `Bearer ${bearerToken(user._id)}`)
    .send({
      name: "Premium",
      price: 12.5,
      frequency: "monthly",
      category: "entertainment",
      startDate: new Date().toISOString(),
      paymentMethod: "Card",
    });

  assert.equal(persisted, true);
  assert.equal(response.status, 500);
  assert.equal(response.body.error, "fetch failed");
});

test("valid but nonexistent subscription IDs currently map to 500", async (t) => {
  t.mock.method(console, "error", () => {});
  const user = authenticatedUser();
  t.mock.method(User, "findById", async () => user);
  t.mock.method(Subscription, "findById", async () => null);

  const response = await request(createApp())
    .get(`/api/v1/subscriptions/${new mongoose.Types.ObjectId()}`)
    .set("Authorization", `Bearer ${bearerToken(user._id)}`);

  assert.equal(response.status, 500);
  assert.equal(response.body.error, "Subscription not found");
});

test("subscription ownership errors currently map to 500", async (t) => {
  t.mock.method(console, "error", () => {});
  const caller = authenticatedUser();
  const otherOwner = new mongoose.Types.ObjectId();
  t.mock.method(User, "findById", async () => caller);
  t.mock.method(Subscription, "findById", async () => ({
    user: otherOwner,
  }));

  const response = await request(createApp())
    .get(`/api/v1/subscriptions/${new mongoose.Types.ObjectId()}`)
    .set("Authorization", `Bearer ${bearerToken(caller._id)}`);

  assert.equal(response.status, 500);
  assert.equal(
    response.body.error,
    "You are not authorized to view this subscription",
  );
});

test("upcoming-renewals is currently shadowed by the dynamic ID route", async (t) => {
  t.mock.method(console, "error", () => {});
  const user = authenticatedUser();
  t.mock.method(User, "findById", async () => user);
  t.mock.method(Subscription, "findById", async () => {
    throw new mongoose.Error.CastError(
      "ObjectId",
      "upcoming-renewals",
      "_id",
    );
  });

  const response = await request(createApp())
    .get("/api/v1/subscriptions/upcoming-renewals")
    .set("Authorization", `Bearer ${bearerToken(user._id)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Resource not found");
});
