
const multer = require("multer");

const errorHandler = (err, req, res, next) => {
  console.error("API Error:", err);

  // Multer upload errors
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Image size must not exceed 5 MB"
          : err.message,
    });
  }

  // Invalid image file type
  if (err.message === "Only image files are allowed") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Invalid input data",
      errors: Object.values(err.errors).map(
        (error) => error.message
      ),
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with this unique value already exists",
    });
  }

  // Invalid MongoDB ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  // Other errors
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

module.exports = errorHandler;
