const express = require('express');
const { createReport } = require('../controllers/report.controller');
const { protect, checkNotSuspended } = require('../middleware/auth.middleware');

const router = express.Router();

// User report creation (protected)
router.post('/', protect, checkNotSuspended, createReport);

module.exports = router;
