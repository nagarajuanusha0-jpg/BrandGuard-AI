const mongoose = require("mongoose");

const findingSchema = new mongoose.Schema(
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

    issue: {
      type: String,
      required: true
    },

    severity: {
      type: String,
      enum: ["Low", "Medium", "High"],
      required: true
    },

    source: {
      type: String,
      default: ""
    },

    explanation: {
      type: String,
      default: ""
    },

    suggestedCorrection: {
      type: String,
      default: ""
    },

    position: {
      start: { type: Number, default: null },
      end: { type: Number, default: null }
    },

    status: {
      type: String,
      enum: ["Open", "Resolved"],
      default: "Open"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Finding", findingSchema);