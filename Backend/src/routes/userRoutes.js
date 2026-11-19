
const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  getProfile,
} = require("../controller/userController");

const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected route
router.get("/profile", protect, getProfile);

module.exports = router;
