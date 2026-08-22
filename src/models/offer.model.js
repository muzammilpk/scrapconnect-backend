const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    scrap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scrap',
      required: [true, 'Scrap reference is required'],
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation reference is required'],
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer reference is required'],
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Offer amount is required'],
      min: [0.01, 'Offer amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected', 'countered', 'cancelled'],
        message: 'Status must be pending, accepted, rejected, countered, or cancelled',
      },
      default: 'pending',
      index: true,
    },
    offeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'OfferedBy user reference is required'],
    },
    parentOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying negotiation history chronologically
offerSchema.index({ conversation: 1, createdAt: -1 });

// Index for checking active pending/accepted offers per scrap
offerSchema.index({ scrap: 1, status: 1 });

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
