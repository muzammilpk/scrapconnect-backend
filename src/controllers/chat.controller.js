const mongoose = require('mongoose');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const { Scrap } = require('../models/scrap.model');

/**
 * Helper to check if a user is a participant of a conversation
 */
const isParticipant = (conversation, userId) => {
  if (!conversation || !userId) return false;
  const uIdStr = userId.toString();
  const buyerId = typeof conversation.buyer === 'object' ? conversation.buyer._id.toString() : conversation.buyer.toString();
  const sellerId = typeof conversation.seller === 'object' ? conversation.seller._id.toString() : conversation.seller.toString();
  return buyerId === uIdStr || sellerId === uIdStr;
};

/**
 * @desc   Create or retrieve an existing conversation for a scrap listing
 * @route  POST /api/chat/conversations
 * @access Private
 */
const createOrGetConversation = async (req, res) => {
  try {
    const { scrapId } = req.body;

    if (!scrapId || !mongoose.Types.ObjectId.isValid(scrapId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid scrap ID is required to start a conversation',
      });
    }

    const scrap = await Scrap.findById(scrapId);
    if (!scrap) {
      return res.status(404).json({
        success: false,
        message: 'Scrap listing not found',
      });
    }

    const sellerId = scrap.seller.toString();
    const buyerId = req.user._id.toString();

    // Prevent seller from contacting self
    if (sellerId === buyerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot start a conversation on your own scrap listing',
      });
    }

    // Check if conversation already exists for this (buyer, seller, scrap)
    let conversation = await Conversation.findOne({
      buyer: buyerId,
      seller: sellerId,
      scrap: scrapId,
    }).populate('buyer seller scrap', 'name email mobileNumber profileImage title category location estimatedWeight weightUnit status');

    if (!conversation) {
      // Create new conversation
      const newConv = await Conversation.create({
        buyer: buyerId,
        seller: sellerId,
        scrap: scrapId,
        lastMessage: 'Conversation started',
        lastMessageAt: new Date(),
      });

      conversation = await Conversation.findById(newConv._id).populate(
        'buyer seller scrap',
        'name email mobileNumber profileImage title category location estimatedWeight weightUnit status'
      );
    }

    res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Create conversation error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating or retrieving conversation',
    });
  }
};

/**
 * @desc   Get all conversations for logged-in user (as buyer or seller)
 * @route  GET /api/chat/conversations
 * @access Private
 */
const getUserConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      $or: [{ buyer: userId }, { seller: userId }],
    })
      .sort({ lastMessageAt: -1 })
      .populate('buyer seller scrap', 'name email mobileNumber profileImage title category location estimatedWeight weightUnit status');

    // Calculate unread count per conversation for current user
    const conversationListWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          isRead: false,
        });

        const convObj = conv.toObject();
        convObj.unreadCount = unreadCount;
        return convObj;
      })
    );

    res.status(200).json({
      success: true,
      count: conversationListWithUnread.length,
      conversations: conversationListWithUnread,
    });
  } catch (error) {
    console.error('Get user conversations error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving conversations',
    });
  }
};

/**
 * @desc   Get single conversation by ID
 * @route  GET /api/chat/conversations/:id
 * @access Private
 */
const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format',
      });
    }

    const conversation = await Conversation.findById(id).populate(
      'buyer seller scrap',
      'name email mobileNumber profileImage title category location estimatedWeight weightUnit status'
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Security check: Only participants can access
    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this conversation',
      });
    }

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      sender: { $ne: req.user._id },
      isRead: false,
    });

    const convObj = conversation.toObject();
    convObj.unreadCount = unreadCount;

    res.status(200).json({
      success: true,
      conversation: convObj,
    });
  } catch (error) {
    console.error('Get conversation error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving conversation',
    });
  }
};

/**
 * @desc   Get message history for a conversation
 * @route  GET /api/chat/conversations/:id/messages
 * @access Private
 */
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format',
      });
    }

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Security check: Only participants can access messages
    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view messages in this conversation',
      });
    }

    const messages = await Message.find({ conversation: id })
      .sort({ createdAt: 1 })
      .populate('sender', 'name email profileImage role');

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error('Get messages error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving chat messages',
    });
  }
};

/**
 * @desc   Send a message via REST API
 * @route  POST /api/chat/conversations/:id/messages
 * @access Private
 */
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format',
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text cannot be empty',
      });
    }

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Security check: Only participants can send messages
    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages in this conversation',
      });
    }

    const messageText = text.trim();

    // Create message in MongoDB
    const message = await Message.create({
      conversation: id,
      sender: req.user._id,
      text: messageText,
      isRead: false,
    });

    // Update conversation lastMessage & lastMessageAt
    await Conversation.findByIdAndUpdate(id, {
      lastMessage: messageText,
      lastMessageAt: message.createdAt,
    });

    const populatedMessage = await Message.findById(message._id).populate('sender', 'name email profileImage role');

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error sending message',
    });
  }
};

/**
 * @desc   Mark messages in conversation as read for current user
 * @route  PATCH /api/chat/conversations/:id/read
 * @access Private
 */
const markConversationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format',
      });
    }

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Security check: Only participants can mark read
    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this conversation',
      });
    }

    // Mark unread messages sent by OTHER participant as read
    const result = await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: req.user._id },
        isRead: false,
      },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    console.error('Mark conversation read error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error marking messages as read',
    });
  }
};

module.exports = {
  createOrGetConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationAsRead,
};
