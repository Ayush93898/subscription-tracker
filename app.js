import express from "express";
import cookieParser from "cookie-parser";
import { PORT } from "./config/env.js";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import connectToDatabase from "./database/mongodb.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import arcjetMiddleware from "./middlewares/arcjet.middleware.js";
import workflowRouter from "./routes/workflow.routes.js";

const app = express();

app.set("trust proxy", true);

app.use(express.json()) // parses JSON body
app.use(express.urlencoded({extended:false})) // parses form data
app.use(cookieParser()) // parses cookies
app.use(arcjetMiddleware)

// app.use() for routers → yes, think of it as prefixing.
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/subsciptions", subscriptionRouter)
app.use("/api/v1/workflows", workflowRouter)

app.use(errorMiddleware)

app.get("/", (req, res) => {
  res.send("welcome to subscription tracker api!");
});

app.listen(PORT, async () => {
  console.log(`Subscription tracker API is running on PORT: ${PORT}`);
  await connectToDatabase()
});

export default app;
