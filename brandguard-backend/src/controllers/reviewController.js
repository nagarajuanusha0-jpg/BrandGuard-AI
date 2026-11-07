const mongoose = require("mongoose");

const Review = require("../models/Review");
const Submission = require("../models/Submission");

// Get submissions waiting for review
const getPendingReviews = async (req, res) => {
  try {
    const submissions = await Submission.find({
      status: {
        $in: [
          "Analysis Complete",
          "Pending Review",
          "Resubmitted"
        ]
      }
    })
      .populate("createdBy", "name email role")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending reviews."
    });
  }
};

// Submit a review decision
const reviewSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID."
      });
    }

    if (!["Approved", "Needs Changes"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be Approved or Needs Changes."
      });
    }

    if (
      decision === "Needs Changes" &&
      (!comment || !comment.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a comment when requesting changes."
      });
    }

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    const reviewableStatuses = [
      "Analysis Complete",
      "Pending Review",
      "Resubmitted"
    ];

    if (!reviewableStatuses.includes(submission.status)) {
      return res.status(400).json({
        success: false,
        message: "This submission is not currently available for review."
      });
    }

    const review = await Review.create({
      submissionId: submission._id,
      revisionNumber: submission.currentRevision,
      reviewedBy: req.user._id,
      decision,
      comment: comment || ""
    });

    submission.status = decision;
    await submission.save();

    return res.status(201).json({
      success: true,
      message: `Submission ${decision.toLowerCase()} successfully.`,
      data: {
        review,
        submission
      }
    });
  } catch (error) {
    console.error("Review error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to submit review."
    });
  }
};

// Get review history
const getReviews = async (req, res) => {
  try {
    let filter = {};

    // Creators can see reviews only for their own submissions
    if (req.user.role === "Creator") {
      const submissions = await Submission.find({
        createdBy: req.user._id
      }).select("_id");

      filter.submissionId = {
        $in: submissions.map(item => item._id)
      };
    } else if (
      !["Admin", "Manager", "Reviewer"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view reviews."
      });
    }

    const reviews = await Review.find(filter)
      .populate("reviewedBy", "name email role")
      .populate("submissionId")
      .sort({ reviewedAt: -1 });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews."
    });
  }
};

// Get review history for one submission
const getSubmissionReviews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID."
      });
    }

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    const isOwner =
      submission.createdBy.toString() === req.user._id.toString();

    const allowedRoles = ["Admin", "Manager", "Reviewer"];

    if (!isOwner && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this review history."
      });
    }

    const reviews = await Review.find({ submissionId: id })
      .populate("reviewedBy", "name email role")
      .sort({ reviewedAt: -1 });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error("Submission review history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch submission review history."
    });
  }
};


module.exports = {
  getPendingReviews,
  reviewSubmission,
  getReviews,
  getSubmissionReviews
};