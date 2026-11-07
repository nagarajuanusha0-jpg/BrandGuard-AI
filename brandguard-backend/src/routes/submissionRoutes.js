const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const submissionUpload = require("../middleware/submissionUpload");

const {
  reviewSubmission,
  getSubmissionReviews
} = require("../controllers/reviewController");

const {
  analyzeSubmission,
  getSubmissionFindings
} = require("../controllers/aiController");

const {
  createSubmission,
  getSubmissions,
  getMySubmissions,
  getSubmissionById,
  updateSubmission,
  getSubmissionRevisions
} = require("../controllers/submissionController");

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

router.get("/mine", allowRoles("Creator"), getMySubmissions);

router.get(
  "/",
  allowRoles("Admin", "Manager", "Reviewer"),
  getSubmissions
);

// AI analysis
router.post(
  "/:id/analyze",
  allowRoles("Creator", "Admin", "Manager"),
  analyzeSubmission
);

// Findings for one submission
router.get("/:id/findings", getSubmissionFindings);

// Review decision
router.post(
  "/:id/review",
  allowRoles("Reviewer"),
  reviewSubmission
);

// Review history
router.get("/:id/reviews", getSubmissionReviews);

// Create submission
router.post(
  "/",
  allowRoles("Creator"),
  submissionUpload.single("file"),
  createSubmission
);

// Revision history
router.get("/:id/revisions", getSubmissionRevisions);

// Get one submission
router.get("/:id", getSubmissionById);

// Update or resubmit
router.patch("/:id", submissionUpload.single("file"), updateSubmission);

module.exports = router;