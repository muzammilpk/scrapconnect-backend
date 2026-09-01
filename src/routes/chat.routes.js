const express = require('express');
const {
  createOrGetConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationAsRead,
  getUnreadChatCount,
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// Unread count
router.get('/unread-count', getUnreadChatCount);
router.get('/conversations/unread-count', getUnreadChatCount);

// Conversations collection
router.route('/conversations')
  .get(getUserConversations)
  .post(createOrGetConversation);

router.route('/')
  .get(getUserConversations)
  .post(createOrGetConversation);

// Single conversation & messages
router.get('/conversations/:id', getConversationById);
router.get('/:id', getConversationById);

router.route('/conversations/:id/messages')
  .get(getMessages)
  .post(sendMessage);

router.route('/:id/messages')
  .get(getMessages)
  .post(sendMessage);

// Mark read
router.patch('/conversations/:id/read', markConversationAsRead);
router.patch('/:id/read', markConversationAsRead);

module.exports = router;
