const mongoose = require('mongoose');
const Deal = require('../models/deal.model');
const Offer = require('../models/offer.model');
const { Scrap } = require('../models/scrap.model');
const Conversation = require('../models/conversation.model');
const notificationService = require('../services/notificationService');

/**
 * Helper to check deal participation
 */
const isDealParticipant = (deal, userId) => {
  if (!deal || !userId) return false;
  const uIdStr = userId.toString();
  const buyerId = typeof deal.buyer === 'object' ? deal.buyer._id.toString() : deal.buyer.toString();
  const sellerId = typeof deal.seller === 'object' ? deal.seller._id.toString() : deal.seller.toString();
  return buyerId === uIdStr || sellerId === uIdStr;
};

/**
 * @desc   Create a Deal from an Accepted Offer
 * @route  POST /api/deals
 * @access Private (Buyer or Seller participant)
 */
const createDeal = async (req, res) => {
  try {
    const { acceptedOfferId, pickupDetails, notes } = req.body;

    if (!acceptedOfferId || !mongoose.Types.ObjectId.isValid(acceptedOfferId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid accepted offer ID is required to create a deal',
      });
    }

    const offer = await Offer.findById(acceptedOfferId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offer.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Deals can only be created from ACCEPTED offers (Current status: ${offer.status})`,
      });
    }

    // Verify user is buyer or seller
    const uIdStr = req.user._id.toString();
    const buyerIdStr = offer.buyer.toString();
    const sellerIdStr = offer.seller.toString();

    if (uIdStr !== buyerIdStr && uIdStr !== sellerIdStr) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create a deal for this offer',
      });
    }

    // Check if an active deal already exists for this scrap
    const existingActiveDeal = await Deal.findOne({
      scrap: offer.scrap,
      status: { $in: ['pending_confirmation', 'confirmed', 'pickup_scheduled'] },
    });

    if (existingActiveDeal) {
      const populatedExisting = await Deal.findById(existingActiveDeal._id)
        .populate('scrap', 'title category description estimatedWeight weightUnit price status location images')
        .populate('buyer', 'name email role phone location')
        .populate('seller', 'name email role phone location')
        .populate('acceptedOffer');

      return res.status(200).json({
        success: true,
        message: 'An active deal already exists for this scrap listing',
        deal: populatedExisting,
      });
    }

    // Create the new deal
    const deal = await Deal.create({
      scrap: offer.scrap,
      buyer: offer.buyer,
      seller: offer.seller,
      acceptedOffer: offer._id,
      agreedPrice: offer.amount,
      currency: offer.currency || 'INR',
      status: 'pending_confirmation',
      pickupDetails: pickupDetails || {},
      notes: notes || '',
    });

    // Ensure Scrap status is reserved
    const scrap = await Scrap.findById(offer.scrap);
    if (scrap && scrap.status !== 'reserved' && scrap.status !== 'sold') {
      scrap.status = 'reserved';
      scrap.buyer = offer.buyer;
      scrap.finalPrice = offer.amount;
      await scrap.save();
    }

    const populatedDeal = await Deal.findById(deal._id)
      .populate('scrap', 'title category description estimatedWeight weightUnit price status location images')
      .populate('buyer', 'name email role phone location')
      .populate('seller', 'name email role phone location')
      .populate('acceptedOffer');

    res.status(201).json({
      success: true,
      message: 'ScrapConnect Deal created successfully!',
      deal: populatedDeal,
    });
  } catch (error) {
    console.error('Create deal error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating deal',
    });
  }
};

/**
 * @desc   Get deals for logged in user (as buyer or seller)
 * @route  GET /api/deals
 * @access Private
 */
const getDeals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    };

    if (status) {
      filter.status = status;
    }

    const deals = await Deal.find(filter)
      .sort({ createdAt: -1 })
      .populate('scrap', 'title category description estimatedWeight weightUnit price status location images')
      .populate('buyer', 'name email role phone location')
      .populate('seller', 'name email role phone location')
      .populate('acceptedOffer');

    res.status(200).json({
      success: true,
      count: deals.length,
      deals,
    });
  } catch (error) {
    console.error('Get deals error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving deals',
    });
  }
};

/**
 * @desc   Get single deal details by ID
 * @route  GET /api/deals/:id
 * @access Private (Buyer or Seller of deal)
 */
const getDealById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deal ID format',
      });
    }

    const deal = await Deal.findById(id)
      .populate('scrap', 'title category description estimatedWeight weightUnit price status location images')
      .populate('buyer', 'name email role phone location')
      .populate('seller', 'name email role phone location')
      .populate('acceptedOffer');

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found',
      });
    }

    if (!isDealParticipant(deal, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this deal',
      });
    }

    // Find conversation ID for linking chat
    const conversation = await Conversation.findOne({
      scrap: deal.scrap._id || deal.scrap,
      buyer: deal.buyer._id || deal.buyer,
      seller: deal.seller._id || deal.seller,
    });

    res.status(200).json({
      success: true,
      deal,
      conversationId: conversation ? conversation._id : null,
    });
  } catch (error) {
    console.error('Get deal by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching deal details',
    });
  }
};

/**
 * @desc   Update deal status (confirm, pickup_scheduled, complete, cancel)
 * @route  PATCH /api/deals/:id/status
 * @access Private (Buyer or Seller of deal)
 */
const updateDealStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;

    const validStatuses = ['confirmed', 'pickup_scheduled', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found',
      });
    }

    if (!isDealParticipant(deal, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this deal',
      });
    }

    // Rule: Completed deals CANNOT be cancelled or modified
    if (deal.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed deals cannot be modified or cancelled',
      });
    }

    const scrap = await Scrap.findById(deal.scrap);

    // Apply Status Transitions
    if (status === 'confirmed') {
      deal.status = 'confirmed';
      if (!deal.confirmedAt) deal.confirmedAt = new Date();
      if (scrap && scrap.status !== 'sold') {
        scrap.status = 'reserved';
        await scrap.save();
      }
    } else if (status === 'pickup_scheduled') {
      deal.status = 'pickup_scheduled';
      if (!deal.confirmedAt) deal.confirmedAt = new Date();
      if (scrap && scrap.status !== 'sold') {
        scrap.status = 'reserved';
        await scrap.save();
      }
    } else if (status === 'completed') {
      deal.status = 'completed';
      deal.completedAt = new Date();
      if (scrap) {
        scrap.status = 'sold';
        scrap.buyer = deal.buyer;
        scrap.finalPrice = deal.agreedPrice;
        await scrap.save();
      }
    } else if (status === 'cancelled') {
      deal.status = 'cancelled';
      deal.cancelledAt = new Date();
      if (cancellationReason) deal.cancellationReason = cancellationReason;

      // Revert scrap status back to available if it was reserved
      if (scrap && scrap.status === 'reserved') {
        scrap.status = 'available';
        scrap.buyer = undefined;
        await scrap.save();
      }
    }

    await deal.save();

    const populatedDeal = await Deal.findById(deal._id)
      .populate('scrap', 'title category description estimatedWeight weightUnit price status location images')
      .populate('buyer', 'name email role phone location')
      .populate('seller', 'name email role phone location')
      .populate('acceptedOffer');

    // Notify other participant of deal update
    try {
      const recipientId = deal.buyer.toString() === req.user._id.toString() ? deal.seller : deal.buyer;
      const scrapTitle = populatedDeal.scrap?.title || 'Scrap Listing';
      const statusTitle = status.replace('_', ' ').toUpperCase();

      await notificationService.createNotification({
        recipient: recipientId,
        type: 'DEAL_UPDATE',
        title: `Deal Status: ${statusTitle} 🤝`,
        message: `The deal status for ${scrapTitle} has been updated to "${status.replace('_', ' ')}".`,
        scrap: deal.scrap,
        deal: deal._id,
      });

      if (status === 'completed') {
        // Request review from both participants
        await notificationService.createNotification({
          recipient: recipientId,
          type: 'REVIEW_REQUEST',
          title: 'Leave a Rating & Review ⭐',
          message: `Your deal for ${scrapTitle} is completed! Tap here to leave your review.`,
          scrap: deal.scrap,
          deal: deal._id,
        });
      }

      // Also send system message to chat conversation if present
      const { sendSystemMessageInConversation } = require('../socket/chatSocket');
      const conv = await Conversation.findOne({ scrap: deal.scrap, buyer: deal.buyer, seller: deal.seller });
      if (conv) {
        await sendSystemMessageInConversation(
          conv._id,
          `🤝 Deal status updated to: ${status.replace('_', ' ').toUpperCase()}`,
          deal._id
        );
      }
    } catch (notifErr) {
      console.error('Failed to send deal update notification:', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Deal status updated to ${status}`,
      deal: populatedDeal,
    });
  } catch (error) {
    console.error('Update deal status error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating deal status',
    });
  }
};

/**
 * @desc   Update pickup details for a deal
 * @route  PATCH /api/deals/:id/pickup
 * @access Private (Buyer or Seller of deal)
 */
const updatePickupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, address, notes } = req.body;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found',
      });
    }

    if (!isDealParticipant(deal, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update pickup details for this deal',
      });
    }

    if (deal.status === 'completed' || deal.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot update pickup details for a deal that is ${deal.status}`,
      });
    }

    // Update pickup details
    deal.pickupDetails = {
      ...deal.pickupDetails,
      ...(date !== undefined && { date }),
      ...(time !== undefined && { time }),
      ...(address !== undefined && { address }),
      ...(notes !== undefined && { notes }),
    };

    // Auto update status to pickup_scheduled if currently pending_confirmation or confirmed
    if (deal.status === 'pending_confirmation' || deal.status === 'confirmed') {
      deal.status = 'pickup_scheduled';
      if (!deal.confirmedAt) deal.confirmedAt = new Date();
    }

    await deal.save();

    const populatedDeal = await Deal.findById(deal._id)
      .populate('scrap', 'title category description estimatedWeight weightUnit price status location images')
      .populate('buyer', 'name email role phone location')
      .populate('seller', 'name email role phone location')
      .populate('acceptedOffer');

    res.status(200).json({
      success: true,
      message: 'Pickup details updated successfully',
      deal: populatedDeal,
    });
  } catch (error) {
    console.error('Update pickup details error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating pickup details',
    });
  }
};

module.exports = {
  createDeal,
  getDeals,
  getDealById,
  updateDealStatus,
  updatePickupDetails,
};
