const mongoose = require('mongoose');

/**
 * Report Schema for ScrapConnect
 * Stores platform reports submitted by users regarding abusive behavior, fraud, or inappropriate content.
 */
const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required'],
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reportedScrap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scrap',
    },
    reportedReview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate_content', 'fraud', 'abusive_behavior', 'other'],
      required: [true, 'Please select a reason for reporting'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
