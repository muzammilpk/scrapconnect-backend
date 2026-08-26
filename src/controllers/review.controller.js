const mongoose = require('mongoose');
const Review = require('../models/review.model');
const Deal = require('../models/deal.model');

/**
 * @desc   Create a rating and review for a completed deal
 * @route  POST /api/reviews
 * @access Private (Deal participant)
 */
const createReview = async (req, res) => {
  try {
    const { dealId, rating, comment } = req.body;

    if (!dealId || !mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid deal ID is required to post a review',
      });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5 stars',
      });
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Associated deal not found',
      });
    }

    // Rule: Reviews can ONLY be posted for completed deals
    if (deal.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Reviews can only be submitted for COMPLETED deals (Current deal status: ${deal.status})`,
      });
    }

    // Security check: Reviewer must be a participant in the deal
    const uIdStr = req.user._id.toString();
    const buyerIdStr = deal.buyer.toString();
    const sellerIdStr = deal.seller.toString();

    if (uIdStr !== buyerIdStr && uIdStr !== sellerIdStr) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to review this deal',
      });
    }

    // Determine reviewee (the other participant)
    const revieweeId = uIdStr === buyerIdStr ? deal.seller : deal.buyer;

    // Prevent self-reviews
    if (uIdStr === revieweeId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot review yourself',
      });
    }

    // Check for existing review by this participant for this deal
    const existingReview = await Review.findOne({
      deal: dealId,
      reviewer: req.user._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this user for this deal',
      });
    }

    const trimmedComment = comment ? String(comment).trim().substring(0, 500) : '';

    const review = await Review.create({
      deal: dealId,
      reviewer: req.user._id,
      reviewee: revieweeId,
      rating: numRating,
      comment: trimmedComment,
    });

    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'name email role profileImage')
      .populate('reviewee', 'name email role')
      .populate('deal', 'agreedPrice status');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully! Thank you for building trust on ScrapConnect.',
      review: populatedReview,
    });
  } catch (error) {
    console.error('Create review error:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this deal',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Server error submitting review',
    });
  }
};

/**
 * @desc   Get reviews received by a user
 * @route  GET /api/reviews/user/:id
 * @access Public / Private
 */
const getUserReviews = async (req, res) => {
  try {
    const { id: userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const reviews = await Review.find({ reviewee: userId })
      .sort({ createdAt: -1 })
      .populate('reviewer', 'name role profileImage')
      .populate({
        path: 'deal',
        select: 'scrap agreedPrice completedAt',
        populate: {
          path: 'scrap',
          select: 'title category',
        },
      });

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error('Get user reviews error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching user reviews',
    });
  }
};

/**
 * @desc   Get rating summary and star distribution for a user
 * @route  GET /api/reviews/user/:id/rating
 * @access Public / Private
 */
const getUserRatingSummary = async (req, res) => {
  try {
    const { id: userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const reviews = await Review.find({ reviewee: userId });
    const totalReviews = reviews.length;

    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    let sum = 0;
    reviews.forEach((r) => {
      sum += r.rating;
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating] += 1;
      }
    });

    const averageRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

    res.status(200).json({
      success: true,
      averageRating,
      totalReviews,
      distribution,
    });
  } catch (error) {
    console.error('Get user rating error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching rating summary',
    });
  }
};

/**
 * @desc   Update a review (original reviewer only)
 * @route  PATCH /api/reviews/:id
 * @access Private (Original reviewer)
 */
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format',
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Security check: Only the original reviewer can edit
    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this review',
      });
    }

    if (rating !== undefined) {
      const numRating = Number(rating);
      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be an integer between 1 and 5 stars',
        });
      }
      review.rating = numRating;
    }

    if (comment !== undefined) {
      review.comment = String(comment).trim().substring(0, 500);
    }

    await review.save();

    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'name email role profileImage')
      .populate('reviewee', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: populatedReview,
    });
  } catch (error) {
    console.error('Update review error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating review',
    });
  }
};

/**
 * @desc   Delete a review (original reviewer only)
 * @route  DELETE /api/reviews/:id
 * @access Private (Original reviewer)
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format',
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this review',
      });
    }

    await Review.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Delete review error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting review',
    });
  }
};

module.exports = {
  createReview,
  getUserReviews,
  getUserRatingSummary,
  updateReview,
  deleteReview,
};
