
const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");

const errorHandler = require("./middleware/errorMiddleware");

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Road Hazard Reporting System API is running",
  });
});

// User routes
app.use("/api/users", userRoutes);

// Report routes
app.use("/api/reports", reportRoutes);

// Handle unknown API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
