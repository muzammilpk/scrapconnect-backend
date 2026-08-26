const express = require('express');
const {
  createReview,
  getUserReviews,
  getUserRatingSummary,
  updateReview,
  deleteReview,
} = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Public / Protected endpoints for user reviews & ratings
router.get('/user/:id', getUserReviews);
router.get('/user/:id/rating', getUserRatingSummary);

// Protected endpoints for review management
router.post('/', protect, createReview);
router.patch('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
