const express = require('express');
const {
  createOrGetConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationAsRead,
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All chat routes require authentication
router.use(protect);

router.post('/conversations', createOrGetConversation);
router.get('/conversations', getUserConversations);
router.get('/conversations/:id', getConversationById);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/read', markConversationAsRead);

module.exports = router;
