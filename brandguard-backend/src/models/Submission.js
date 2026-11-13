
const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileId: String,
    originalName: String,
    mimeType: String,
    size: Number,
    storagePath: String
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      trim: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Analyzing",
        "Analysis Complete",
        "Needs Changes",
        "Resubmitted",
        "Pending Review",
        "Approved"
      ],
      default: "Submitted"
    },

    currentRevision: {
      type: Number,
      default: 1
    },

    attachments: [attachmentSchema],

    submittedAt: {
      type: Date,
      default: Date.now
    },

    // Latest AI analysis information
    complianceScore: {
      type: Number,
      default: null
    },

    analyzedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Submission", submissionSchema);
