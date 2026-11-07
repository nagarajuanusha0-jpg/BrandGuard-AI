
const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema(
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
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: String,
    category: String,
    description: {
      type: String,
      required: true
    },
    attachments: [
      {
        fileId: String,
        originalName: String,
        mimeType: String,
        size: Number,
        storagePath: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Revision", revisionSchema);
