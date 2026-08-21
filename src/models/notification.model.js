const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['new_scrap_nearby'],
        message: 'Invalid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    scrap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scrap',
      required: [true, 'Associated scrap reference is required'],
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient user notification query & sorting
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Index for quick deduplication check
notificationSchema.index({ recipient: 1, scrap: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
