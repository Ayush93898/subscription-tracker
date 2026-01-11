import express from "express";
import { PORT } from "./config/env.js";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import connectToDatabase from "./database/mongodb.js";

const app = express();

// app.use() for routers → yes, think of it as prefixing.
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/subsciptions", subscriptionRouter)

app.get("/", (req, res) => {
  res.send("welcome to subscription tracker api!");
});

app.listen(PORT, async () => {
  console.log(`Subscription tracker API is running on PORT: ${PORT}`);
  await connectToDatabase()
});

export default app;
