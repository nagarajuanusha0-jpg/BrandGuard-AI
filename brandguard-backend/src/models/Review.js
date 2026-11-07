const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      required: true
    },

    revisionNumber: {
      type: Number,
      required: true
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    decision: {
      type: String,
      enum: ["Approved", "Needs Changes"],
      required: true
    },

    comment: {
      type: String,
      trim: true,
      default: ""
    },

    reviewedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Review", reviewSchema);