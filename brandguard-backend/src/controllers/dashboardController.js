const User = require("../models/User");
const Guideline = require("../models/Guideline");
const Submission = require("../models/Submission");
const Review = require("../models/Review");

// Get dashboard statistics
const getDashboardSummary = async (req, res) => {
  try {
    const isCreator = req.user.role === "Creator";

    const submissionFilter = isCreator
      ? { createdBy: req.user._id }
      : {};

    const [
      totalSubmissions,
      pendingReviews,
      approvedSubmissions,
      needsChanges,
      totalUsers,
      totalGuidelines
    ] = await Promise.all([
      Submission.countDocuments(submissionFilter),

      Submission.countDocuments({
        ...submissionFilter,
        status: {
          $in: [
            "Analysis Complete",
            "Pending Review",
            "Resubmitted"
          ]
        }
      }),

      Submission.countDocuments({
        ...submissionFilter,
        status: "Approved"
      }),

      Submission.countDocuments({
        ...submissionFilter,
        status: "Needs Changes"
      }),

      User.countDocuments(),

      Guideline.countDocuments({ isActive: true })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalSubmissions,
        pendingReviews,
        approvedSubmissions,
        needsChanges,
        totalUsers,
        totalGuidelines
      }
    });
  } catch (error) {
    console.error("Dashboard summary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary."
    });
  }
};

// Get recent dashboard activity
const getDashboardActivity = async (req, res) => {
  try {
    const isCreator = req.user.role === "Creator";

    const submissionFilter = isCreator
      ? { createdBy: req.user._id }
      : {};

    const reviewFilter = {};

    if (isCreator) {
      const ownSubmissions = await Submission.find({
        createdBy: req.user._id
      }).select("_id");

      reviewFilter.submissionId = {
        $in: ownSubmissions.map(item => item._id)
      };
    }

    const [submissions, reviews] = await Promise.all([
      Submission.find(submissionFilter)
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .limit(10),

      Review.find(reviewFilter)
        .populate("reviewedBy", "name")
        .populate("submissionId", "title")
        .sort({ reviewedAt: -1 })
        .limit(10)
    ]);

    const submissionActivities = submissions.map(item => ({
      type: "Submission",
      title: item.title,
      description: `Submission created by ${item.createdBy?.name || "Unknown user"}`,
      status: item.status,
      date: item.createdAt
    }));

    const reviewActivities = reviews
      .filter(item => item.submissionId)
      .map(item => ({
        type: "Review",
        title: item.submissionId.title,
        description: `Reviewed by ${item.reviewedBy?.name || "Unknown user"}`,
        status: item.decision,
        date: item.reviewedAt
      }));

    const activities = [
      ...submissionActivities,
      ...reviewActivities
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    console.error("Dashboard activity error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard activity."
    });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardActivity
};