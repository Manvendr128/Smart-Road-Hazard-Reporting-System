
const express = require("express");
const router = express.Router();

const {
  createReport,
  getAllReports,
  getMyReports,
  getReportById,
  updateReportStatus,
} = require("../controller/reportController");

const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Public user: Create report with image
router.post("/", protect, upload.single("image"), createReport);

// Public user: Get own reports
router.get("/my-reports", protect, getMyReports);

// Admin: Get all reports
router.get("/", protect, adminOnly, getAllReports);

// Admin: Update report status
router.patch("/:id/status", protect, adminOnly, updateReportStatus);

// Authenticated user: Get report by ID
router.get("/:id", protect, getReportById);

module.exports = router;
