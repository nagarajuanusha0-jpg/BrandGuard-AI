
const mongoose = require('mongoose');

const guidelineSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Brand Guidelines',
        'Brand Facts',
        'Terminology'
      ]
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    attachment: {
      fileId: String,
      originalName: String,
      mimeType: String,
      size: Number,
      storagePath: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guideline', guidelineSchema);
