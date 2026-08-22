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

/**
 * Initializes Socket.IO server with JWT authentication middleware and room handlers
 * @param {Object} httpServer - Node HTTP Server instance
 * @returns {Object} Socket.IO server instance
 */
const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

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
    console.log(`🔌 [Socket.IO] Connected: ${socket.user.name} (${socket.user._id})`);

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

        const trimmedText = text.trim();

        // Save message in MongoDB
        const message = await Message.create({
          conversation: conversationId,
          sender: socket.user._id,
          text: trimmedText,
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

        // Emit new message event to conversation room
        const roomName = `conversation:${conversationId}`;
        io.to(roomName).emit('new_message', populatedMessage);
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
          { isRead: true }
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
          eventType, // 'created', 'countered', 'accepted', 'rejected', 'cancelled'
        });
      }
    });

    // Disconnect Event
    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.IO] Disconnected: ${socket.user.name} (${socket.user._id})`);
    });
  });

  return io;
};

module.exports = {
  initSocketServer,
};
