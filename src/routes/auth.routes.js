const express = require('express');
const { registerUser, loginUser, getMe, changePassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// Public auth routes with rate limiting
router.post('/register', authRateLimiter, registerUser);
router.post('/login', authRateLimiter, loginUser);

// Protected auth routes
router.get('/me', protect, getMe);
router.post('/change-password', protect, authRateLimiter, changePassword);

module.exports = router;
