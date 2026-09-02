const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');

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

let ioInstance = null;
const onlineUsers = new Map(); // userId -> socketId

/**
 * Initializes Socket.IO server with JWT authentication middleware and room handlers
 * @param {Object} httpServer - Node HTTP Server instance
 * @returns {Object} Socket.IO server instance
 */
const initSocketServer = (httpServer) => {
  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ]
    .filter(Boolean)
    .map((url) => url.replace(/\/$/, ''));

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(cleanOrigin) || process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance = io;

  // Socket.IO Middleware for JWT Authentication
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select('_id name email role profileImage');

      if (!user) {
        return next(new Error('User not found or unauthenticated'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err.message);
      next(new Error('Authentication error: ' + err.message));
    }
  });

  // Connection Event
  io.on('connection', (socket) => {
    const userIdStr = socket.user._id.toString();
    onlineUsers.set(userIdStr, socket.id);
    console.log(`🔌 [Socket.IO] Connected: ${socket.user.name} (${userIdStr})`);

    // Broadcast user online status
    io.emit('user_online', { userId: userIdStr });

    // Auto-join user to personal room for real-time notification alerts
    const userRoom = `user:${userIdStr}`;
    socket.join(userRoom);

    // Check online status of target user
    socket.on('check_online_status', ({ userId }, callback) => {
      const isOnline = onlineUsers.has(userId);
      if (typeof callback === 'function') {
        callback({ online: isOnline, userId });
      }
    });

    // 1. Join Conversation Room
    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, socket.user._id)) {
          return socket.emit('chat_error', { message: 'Unauthorized or conversation not found' });
        }

        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);
        console.log(`💬 User ${socket.user.name} joined room: ${roomName}`);
      } catch (err) {
        socket.emit('chat_error', { message: err.message });
      }
    });

    // 2. Leave Conversation Room
    socket.on('leave_conversation', ({ conversationId }) => {
      if (conversationId) {
        const roomName = `conversation:${conversationId}`;
        socket.leave(roomName);
        console.log(`👋 User ${socket.user.name} left room: ${roomName}`);
      }
    });

    // 3. Real-Time Send Message
    socket.on('send_message', async ({ conversationId, text }) => {
      try {
        if (!conversationId || !text || !text.trim()) {
          return socket.emit('chat_error', { message: 'Message text and conversation ID are required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, socket.user._id)) {
          return socket.emit('chat_error', { message: 'Unauthorized or conversation not found' });
        }

        // Enforce 2000 character limit & sanitize
        const trimmedText = text.trim().substring(0, 2000).replace(/<[^>]*>?/gm, '');

        // Determine recipient ID
        const recipientId = conversation.buyer.toString() === userIdStr ? conversation.seller : conversation.buyer;
        const recipientOnline = onlineUsers.has(recipientId.toString());

        // Save message in MongoDB
        const message = await Message.create({
          conversation: conversationId,
          sender: socket.user._id,
          text: trimmedText,
          messageType: 'TEXT',
          status: recipientOnline ? 'delivered' : 'sent',
          isRead: false,
        });

        // Update conversation lastMessage & lastMessageAt
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: trimmedText,
          lastMessageAt: message.createdAt,
        });

        const populatedMessage = await Message.findById(message._id).populate(
          'sender',
          'name email profileImage role'
        );

        // Emit new message events to conversation room
        const roomName = `conversation:${conversationId}`;
        io.to(roomName).emit('message:new', populatedMessage);
        io.to(roomName).emit('new_message', populatedMessage);

        // Trigger in-app notification for recipient
        try {
          const notificationService = require('../services/notificationService');
          await notificationService.createNotification({
            recipient: recipientId,
            type: 'NEW_MESSAGE',
            title: `New Message from ${socket.user.name} 💬`,
            message: trimmedText.length > 60 ? `${trimmedText.substring(0, 60)}...` : trimmedText,
            conversation: conversationId,
            scrap: conversation.scrap,
          });
        } catch (notifErr) {
          // Quiet background alert error
        }
      } catch (err) {
        console.error('Socket send message error:', err.message);
        socket.emit('chat_error', { message: err.message });
      }
    });

    // 4. Typing Start Event
    socket.on('typing_start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.user._id,
          userName: socket.user.name,
          conversationId,
        });
      }
    });

    // 5. Typing Stop Event
    socket.on('typing_stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
          userId: socket.user._id,
          conversationId,
        });
      }
    });

    // 6. Mark Read Event
    socket.on('message_read', async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.user._id },
            isRead: false,
          },
          { isRead: true, status: 'read' }
        );

        io.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          readBy: socket.user._id,
        });
      } catch (err) {
        console.error('Socket mark read error:', err.message);
      }
    });

    // 7. Real-Time Offer Updates Event
    socket.on('notify_offer_update', ({ conversationId, offer, eventType }) => {
      if (conversationId && offer) {
        io.to(`conversation:${conversationId}`).emit('offer_updated', {
          conversationId,
          offer,
          eventType,
        });
      }
    });

    // 8. Real-Time Deal Updates Event
    socket.on('notify_deal_update', ({ conversationId, deal, eventType }) => {
      if (deal) {
        if (conversationId) {
          io.to(`conversation:${conversationId}`).emit('deal_updated', {
            deal,
            eventType,
          });
        }
        io.emit('deal_updated', {
          deal,
          eventType,
        });
      }
    });

    // Disconnect Event
    socket.on('disconnect', () => {
      onlineUsers.delete(userIdStr);
      io.emit('user_offline', { userId: userIdStr });
      console.log(`🔌 [Socket.IO] Disconnected: ${socket.user.name} (${userIdStr})`);
    });
  });

  return io;
};

/**
 * Emits real-time notification to a specific user's personal socket room
 */
const sendSocketNotification = (recipientId, notification) => {
  if (ioInstance && recipientId) {
    const room = `user:${recipientId.toString()}`;
    ioInstance.to(room).emit('notification:new', notification);
  }
};

/**
 * Sends a structured SYSTEM message into a conversation
 */
const sendSystemMessageInConversation = async (conversationId, text, dealId = null, offerId = null) => {
  try {
    if (!conversationId || !text) return null;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return null;

    const sysMessage = await Message.create({
      conversation: conversationId,
      sender: conversation.seller, // Attach to seller reference as placeholder for system messages
      text,
      messageType: 'SYSTEM',
      status: 'read',
      isRead: true,
      deal: dealId,
      offer: offerId,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: `[SYSTEM] ${text}`,
      lastMessageAt: sysMessage.createdAt,
    });

    if (ioInstance) {
      const roomName = `conversation:${conversationId}`;
      ioInstance.to(roomName).emit('message:new', sysMessage);
      ioInstance.to(roomName).emit('new_message', sysMessage);
    }

    return sysMessage;
  } catch (err) {
    console.error('Failed to send system message:', err.message);
    return null;
  }
};

module.exports = {
  initSocketServer,
  sendSocketNotification,
  sendSystemMessageInConversation,
  getIO: () => ioInstance,
  isUserOnline: (userId) => onlineUsers.has(userId ? userId.toString() : ''),
};
