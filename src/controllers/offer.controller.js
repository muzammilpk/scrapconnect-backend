const mongoose = require('mongoose');
const Offer = require('../models/offer.model');
const Conversation = require('../models/conversation.model');
const { Scrap } = require('../models/scrap.model');

/**
 * Helper to check participant access
 */
const isParticipant = (conversation, userId) => {
  if (!conversation || !userId) return false;
  const uIdStr = userId.toString();
  const buyerId = typeof conversation.buyer === 'object' ? conversation.buyer._id.toString() : conversation.buyer.toString();
  const sellerId = typeof conversation.seller === 'object' ? conversation.seller._id.toString() : conversation.seller.toString();
  return buyerId === uIdStr || sellerId === uIdStr;
};

/**
 * @desc   Create initial price offer
 * @route  POST /api/offers
 * @access Private (Buyer participant)
 */
const createOffer = async (req, res) => {
  try {
    const { conversationId, amount } = req.body;

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid conversation ID is required to make an offer',
      });
    }

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Offer amount must be a positive number greater than 0',
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Security check: Only participants can make offers
    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to make an offer in this conversation',
      });
    }

    const scrap = await Scrap.findById(conversation.scrap);
    if (!scrap) {
      return res.status(404).json({
        success: false,
        message: 'Associated scrap listing not found',
      });
    }

    if (scrap.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Scrap listing is currently ${scrap.status} and not open for new offers`,
      });
    }

    // If there is an existing pending offer in this conversation by the same caller, mark it cancelled
    await Offer.updateMany(
      {
        conversation: conversationId,
        offeredBy: req.user._id,
        status: 'pending',
      },
      { status: 'cancelled' }
    );

    const offer = await Offer.create({
      scrap: scrap._id,
      conversation: conversation._id,
      buyer: conversation.buyer,
      seller: conversation.seller,
      amount: Number(amount),
      currency: 'INR',
      status: 'pending',
      offeredBy: req.user._id,
    });

    const populatedOffer = await Offer.findById(offer._id)
      .populate('offeredBy', 'name email role')
      .populate('scrap', 'title category estimatedWeight weightUnit status');

    res.status(201).json({
      success: true,
      message: 'Price offer created successfully',
      offer: populatedOffer,
    });
  } catch (error) {
    console.error('Create offer error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating price offer',
    });
  }
};

/**
 * @desc   Create counter offer for an existing pending offer
 * @route  POST /api/offers/:id/counter
 * @access Private (Opposite participant)
 */
const counterOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offer ID format',
      });
    }

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Counter offer amount must be a positive number greater than 0',
      });
    }

    const parentOffer = await Offer.findById(id);
    if (!parentOffer) {
      return res.status(404).json({
        success: false,
        message: 'Parent offer not found',
      });
    }

    if (parentOffer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot counter an offer that is already ${parentOffer.status}`,
      });
    }

    const conversation = await Conversation.findById(parentOffer.conversation);
    if (!conversation || !isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to counter this offer',
      });
    }

    // Must be the opposite participant (not the creator of parent offer)
    if (parentOffer.offeredBy.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot counter your own offer. Update or make a new offer instead.',
      });
    }

    const scrap = await Scrap.findById(parentOffer.scrap);
    if (!scrap || scrap.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Associated scrap listing is not available for negotiation',
      });
    }

    // Mark parent offer as countered
    parentOffer.status = 'countered';
    await parentOffer.save();

    // Create new counter offer
    const counter = await Offer.create({
      scrap: parentOffer.scrap,
      conversation: parentOffer.conversation,
      buyer: parentOffer.buyer,
      seller: parentOffer.seller,
      amount: Number(amount),
      currency: 'INR',
      status: 'pending',
      offeredBy: req.user._id,
      parentOffer: parentOffer._id,
    });

    const populatedCounter = await Offer.findById(counter._id)
      .populate('offeredBy', 'name email role')
      .populate('parentOffer')
      .populate('scrap', 'title category estimatedWeight weightUnit status');

    res.status(201).json({
      success: true,
      message: 'Counter offer submitted successfully',
      offer: populatedCounter,
    });
  } catch (error) {
    console.error('Counter offer error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating counter offer',
    });
  }
};

/**
 * @desc   Accept an offer (Sets offer to accepted, scrap to reserved)
 * @route  POST /api/offers/:id/accept
 * @access Private (Opposite participant)
 */
const acceptOffer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offer ID format',
      });
    }

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept an offer that is already ${offer.status}`,
      });
    }

    const conversation = await Conversation.findById(offer.conversation);
    if (!conversation || !isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to accept this offer',
      });
    }

    // Must be opposite participant (cannot accept own offer)
    if (offer.offeredBy.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot accept your own offer',
      });
    }

    const scrap = await Scrap.findById(offer.scrap);
    if (!scrap || scrap.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Scrap listing is no longer available for acceptance',
      });
    }

    // Mark current offer as accepted
    offer.status = 'accepted';
    await offer.save();

    // Cancel all other pending offers in this conversation
    await Offer.updateMany(
      {
        conversation: offer.conversation,
        _id: { $ne: offer._id },
        status: 'pending',
      },
      { status: 'cancelled' }
    );

    // Update Scrap status to 'reserved'
    scrap.status = 'reserved';
    await scrap.save();

    const populatedOffer = await Offer.findById(offer._id)
      .populate('offeredBy', 'name email role')
      .populate('scrap', 'title category estimatedWeight weightUnit status');

    res.status(200).json({
      success: true,
      message: 'Offer accepted successfully! Scrap listing is now reserved.',
      offer: populatedOffer,
      scrap,
    });
  } catch (error) {
    console.error('Accept offer error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error accepting offer',
    });
  }
};

/**
 * @desc   Reject an offer
 * @route  POST /api/offers/:id/reject
 * @access Private (Opposite participant)
 */
const rejectOffer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offer ID format',
      });
    }

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject an offer that is already ${offer.status}`,
      });
    }

    const conversation = await Conversation.findById(offer.conversation);
    if (!conversation || !isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this offer',
      });
    }

    if (offer.offeredBy.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot reject your own offer. Use cancel instead.',
      });
    }

    offer.status = 'rejected';
    await offer.save();

    const populatedOffer = await Offer.findById(offer._id).populate('offeredBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Offer rejected',
      offer: populatedOffer,
    });
  } catch (error) {
    console.error('Reject offer error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error rejecting offer',
    });
  }
};

/**
 * @desc   Cancel own pending offer
 * @route  POST /api/offers/:id/cancel
 * @access Private (Offer creator)
 */
const cancelOffer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offer ID format',
      });
    }

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an offer that is already ${offer.status}`,
      });
    }

    if (offer.offeredBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own offer',
      });
    }

    offer.status = 'cancelled';
    await offer.save();

    const populatedOffer = await Offer.findById(offer._id).populate('offeredBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Offer cancelled',
      offer: populatedOffer,
    });
  } catch (error) {
    console.error('Cancel offer error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error cancelling offer',
    });
  }
};

/**
 * @desc   Get negotiation history and active offer for a conversation
 * @route  GET /api/offers/conversation/:conversationId
 * @access Private (Participants)
 */
const getConversationOffers = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format',
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view offers for this conversation',
      });
    }

    const offers = await Offer.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate('offeredBy', 'name email role')
      .populate('parentOffer');

    const pendingOffer = offers.slice().reverse().find((o) => o.status === 'pending') || null;
    const acceptedOffer = offers.find((o) => o.status === 'accepted') || null;

    res.status(200).json({
      success: true,
      count: offers.length,
      offers,
      pendingOffer,
      acceptedOffer,
    });
  } catch (error) {
    console.error('Get conversation offers error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving offer history',
    });
  }
};

module.exports = {
  createOffer,
  counterOffer,
  acceptOffer,
  rejectOffer,
  cancelOffer,
  getConversationOffers,
};
