const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getPendingReviews,
  getReviews
} = require("../controllers/reviewController");

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action."
      });
    }

    next();
  };
};

router.use(protect);

// Get pending submissions
router.get(
  "/pending",
  allowRoles("Admin", "Manager", "Reviewer"),
  getPendingReviews
);

// Get review history
router.get("/", getReviews);

module.exports = router;