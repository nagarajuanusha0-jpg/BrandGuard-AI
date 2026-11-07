const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getDashboardSummary,
  getDashboardActivity
} = require("../controllers/dashboardController");

router.use(protect);

// Dashboard statistics
router.get("/summary", getDashboardSummary);

// Recent activity
router.get("/activity", getDashboardActivity);

module.exports = router;