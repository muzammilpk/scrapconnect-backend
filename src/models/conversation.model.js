const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer is required for conversation'],
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required for conversation'],
      index: true,
    },
    scrap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scrap',
      required: [true, 'Associated scrap listing is required'],
      index: true,
    },
    lastMessage: {
      type: String,
      default: '',
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique conversation per (buyer, seller, scrap) triplet
conversationSchema.index({ buyer: 1, seller: 1, scrap: 1 }, { unique: true });

// Compound index for fast listing of user conversations sorted by latest activity
conversationSchema.index({ buyer: 1, lastMessageAt: -1 });
conversationSchema.index({ seller: 1, lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
