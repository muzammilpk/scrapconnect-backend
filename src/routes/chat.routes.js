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
const { validateObjectId } = require('../middleware/validate.middleware');
const { strictActionLimiter } = require('../middleware/rateLimit.middleware');

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
router.get('/conversations/:id', validateObjectId('id'), getConversationById);
router.get('/:id', validateObjectId('id'), getConversationById);

router.route('/conversations/:id/messages')
  .get(validateObjectId('id'), getMessages)
  .post(validateObjectId('id'), strictActionLimiter, sendMessage);

router.route('/:id/messages')
  .get(validateObjectId('id'), getMessages)
  .post(validateObjectId('id'), strictActionLimiter, sendMessage);

// Mark read
router.patch('/conversations/:id/read', validateObjectId('id'), markConversationAsRead);
router.patch('/:id/read', validateObjectId('id'), markConversationAsRead);

module.exports = router;
