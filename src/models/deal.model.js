const mongoose = require('mongoose');

/**
 * Deal Schema for ScrapConnect
 * Represents a formal transaction/agreement created from an accepted price offer.
 */
const dealSchema = new mongoose.Schema(
  {
    scrap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scrap',
      required: [true, 'Scrap reference is required for a deal'],
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer reference is required for a deal'],
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required for a deal'],
      index: true,
    },
    acceptedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      required: [true, 'Accepted offer reference is required for a deal'],
    },
    agreedPrice: {
      type: Number,
      required: [true, 'Agreed price is required for a deal'],
      min: [0, 'Agreed price must be a positive number'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending_confirmation', 'confirmed', 'pickup_scheduled', 'completed', 'cancelled'],
      default: 'pending_confirmation',
      index: true,
    },
    pickupDetails: {
      date: {
        type: Date,
      },
      time: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
      notes: {
        type: String,
        trim: true,
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    confirmedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for rapid querying of deals by buyer, seller, scrap, and creation date
dealSchema.index({ buyer: 1, createdAt: -1 });
dealSchema.index({ seller: 1, createdAt: -1 });
dealSchema.index({ scrap: 1, status: 1 });

const Deal = mongoose.model('Deal', dealSchema);

module.exports = Deal;
