// Error handler middleware – always send valid JSON so frontend never gets "Unexpected end of JSON input"
const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = (err && err.message) ? String(err.message) : "Server Error";

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    message = "Resource not found";
    statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    message = "Duplicate field value entered";
    statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === "ValidationError" && err.errors) {
    try {
      message = Object.values(err.errors)
        .map((val) => (val && val.message) ? String(val.message) : "")
        .filter(Boolean)
        .join(", ") || "Validation failed";
    } catch (e) {
      message = "Validation failed";
    }
    statusCode = 400;
  }

  const payload = {
    success: false,
    message,
  };
  if (process.env.NODE_ENV === "development" && err && err.stack) {
    payload.stack = String(err.stack);
  }

  res.status(statusCode).json(payload);
};

module.exports = errorHandler;


