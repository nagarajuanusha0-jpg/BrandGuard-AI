
const express = require("express");
const router = express.Router();

const { login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Login API
router.post("/login", login);

// Get logged-in user details
router.get("/me", protect, getMe);

module.exports = router;
