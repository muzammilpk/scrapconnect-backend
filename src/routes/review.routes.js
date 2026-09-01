const express = require('express');
const {
  createReview,
  getUserReviews,
  getUserRatingSummary,
  updateReview,
  deleteReview,
} = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validate.middleware');

const router = express.Router();

// Public / Protected endpoints for user reviews & ratings
router.get('/user/:id', validateObjectId('id'), getUserReviews);
router.get('/user/:id/rating', validateObjectId('id'), getUserRatingSummary);

// Protected endpoints for review management
router.post('/', protect, createReview);
router.patch('/:id', protect, validateObjectId('id'), updateReview);
router.delete('/:id', protect, validateObjectId('id'), deleteReview);

module.exports = router;
