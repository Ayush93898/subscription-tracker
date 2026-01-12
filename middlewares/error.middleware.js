// Central error-handling middleware (err, req, res, next)
const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Server Error";

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    statusCode = 404;
    message = "Resource not found"; //ID is invalid → resource doesn’t exist
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate field value entered";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
export default errorMiddleware;
