const express = require('express');
const { createReport } = require('../controllers/report.controller');
const { protect, checkNotSuspended } = require('../middleware/auth.middleware');
const { strictActionLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// User report creation (protected with rate limiting)
router.post('/', protect, checkNotSuspended, strictActionLimiter, createReport);

module.exports = router;
