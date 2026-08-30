const mongoose = require('mongoose');
const User = require('../models/user.model');
const { Scrap } = require('../models/scrap.model');
const Offer = require('../models/offer.model');
const Deal = require('../models/deal.model');
const Review = require('../models/review.model');

/**
 * @desc   Get current logged in user profile
 * @route  GET /api/users/me or GET /api/users/profile
 * @access Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching profile',
    });
  }
};

/**
 * @desc   Update current logged in user profile and location
 * @route  PATCH /api/users/me or PUT /api/users/profile
 * @access Private
 */
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // SECURITY: Strictly filter out restricted fields to prevent privilege escalation
    const {
      name,
      mobileNumber,
      profileImage,
      address,
      location,
    } = req.body;

    // 1. Validation: Name cannot be empty if supplied
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty',
        });
      }
      user.name = name.trim();
    }

    // 2. Validation: Mobile number uniqueness check if modified
    if (mobileNumber !== undefined && mobileNumber !== user.mobileNumber) {
      if (mobileNumber && mobileNumber.trim() !== '') {
        const mobileRegex = /^[0-9]{10,15}$/;
        if (!mobileRegex.test(mobileNumber.trim())) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid mobile number (10-15 digits)',
          });
        }

        const existingUser = await User.findOne({
          mobileNumber: mobileNumber.trim(),
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'An account with this mobile number already exists',
          });
        }
        user.mobileNumber = mobileNumber.trim();
      } else {
        user.mobileNumber = undefined;
      }
    }

    // 3. Optional profile image & address updates
    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (address !== undefined) {
      user.address = address.trim();
    }

    // 4. Update Location details if provided
    if (location && typeof location === 'object') {
      const { state, district, city, area, pincode, latitude, longitude } = location;

      if (pincode !== undefined && pincode !== null && pincode !== '') {
        const pincodeClean = String(pincode).trim();
        const pincodeRegex = /^[0-9]{5,10}$/;
        if (!pincodeRegex.test(pincodeClean)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid pincode (5 to 10 digits)',
          });
        }
      }

      user.location = {
        state: state !== undefined ? String(state).trim() : user.location.state,
        district: district !== undefined ? String(district).trim() : user.location.district,
        city: city !== undefined ? String(city).trim() : user.location.city,
        area: area !== undefined ? String(area).trim() : user.location.area,
        pincode: pincode !== undefined ? String(pincode).trim() : user.location.pincode,
        latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : user.location.latitude,
        longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : user.location.longitude,
      };
    }

    // Save updated user to MongoDB
    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating profile',
    });
  }
};

/**
 * @desc   Deactivate current user's account
 * @route  PATCH /api/users/me/status
 * @access Private
 */
const deactivateAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    user.status = 'suspended';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Deactivate account error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deactivating account',
    });
  }
};

/**
 * @desc   Get authenticated user's dynamic role statistics
 * @route  GET /api/users/me/stats
 * @access Private
 */
const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    // Calculate rating and review count from Review collection
    const reviewStats = await Review.aggregate([
      { $match: { targetUser: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$targetUser',
          averageRating: { $avg: '$rating' },
          receivedReviews: { $sum: 1 },
        },
      },
    ]);

    const averageRating = reviewStats.length > 0 ? parseFloat(reviewStats[0].averageRating.toFixed(1)) : 0;
    const receivedReviews = reviewStats.length > 0 ? reviewStats[0].receivedReviews : 0;

    let stats = {};

    if (role === 'seller') {
      const [activeListings, completedDeals, soldScrap] = await Promise.all([
        Scrap.countDocuments({ seller: userId, status: 'available' }),
        Deal.countDocuments({ seller: userId, status: 'completed' }),
        Scrap.countDocuments({ seller: userId, status: 'sold' }),
      ]);

      stats = {
        role: 'seller',
        activeListings,
        completedDeals,
        soldScrap,
        receivedReviews,
        averageRating,
      };
    } else if (role === 'buyer') {
      const [offersMade, activeDeals, completedDeals] = await Promise.all([
        Offer.countDocuments({ buyer: userId }),
        Deal.countDocuments({ buyer: userId, status: { $in: ['accepted', 'pickup_scheduled', 'in_progress'] } }),
        Deal.countDocuments({ buyer: userId, status: 'completed' }),
      ]);

      stats = {
        role: 'buyer',
        offersMade,
        activeDeals,
        completedDeals,
        receivedReviews,
        averageRating,
      };
    } else {
      stats = {
        role: 'admin',
        receivedReviews,
        averageRating,
      };
    }

    res.status(200).json({
      success: true,
      stats,
      data: stats,
    });
  } catch (error) {
    console.error('Get user stats error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving user statistics',
    });
  }
};

/**
 * @desc   Get safe public profile of any user by ID
 * @route  GET /api/users/:id/profile
 * @access Private
 */
const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const user = await User.findById(id).select('name role profileImage location createdAt status');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    // Calculate rating & completed deals from DB
    const [reviewStats, completedDealsCount, activeListingsCount] = await Promise.all([
      Review.aggregate([
        { $match: { targetUser: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: '$targetUser',
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ]),
      Deal.countDocuments({
        $or: [{ seller: id }, { buyer: id }],
        status: 'completed',
      }),
      user.role === 'seller' ? Scrap.countDocuments({ seller: id, status: 'available' }) : Promise.resolve(0),
    ]);

    const rating = reviewStats.length > 0 ? parseFloat(reviewStats[0].averageRating.toFixed(1)) : 0;
    const reviewCount = reviewStats.length > 0 ? reviewStats[0].reviewCount : 0;

    const publicProfile = {
      id: user._id,
      _id: user._id,
      name: user.name,
      role: user.role,
      profileImage: user.profileImage || '',
      location: {
        state: user.location?.state || '',
        district: user.location?.district || '',
        city: user.location?.city || '',
      },
      rating,
      reviewCount,
      completedDeals: completedDealsCount,
      activeListingsCount: user.role === 'seller' ? activeListingsCount : undefined,
      createdAt: user.createdAt,
      status: user.status,
    };

    res.status(200).json({
      success: true,
      profile: publicProfile,
      user: publicProfile,
      data: publicProfile,
    });
  } catch (error) {
    console.error('Get public profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving public profile',
    });
  }
};

/**
 * @desc   Get active public listings for a seller
 * @route  GET /api/users/:id/listings
 * @access Private
 */
const getPublicSellerListings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const seller = await User.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found',
      });
    }

    const scraps = await Scrap.find({
      seller: id,
      status: 'available',
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: scraps.length,
      scraps,
      data: scraps,
    });
  } catch (error) {
    console.error('Get public seller listings error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving seller listings',
    });
  }
};

/**
 * @desc   Get authenticated user's notification preferences
 * @route  GET /api/users/me/notification-preferences
 * @access Private
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');

    res.status(200).json({
      success: true,
      notificationPreferences: user?.notificationPreferences || {
        newScrapInRegion: true,
        newMessages: true,
        offers: true,
        dealUpdates: true,
        reviewReminders: true,
      },
    });
  } catch (error) {
    console.error('Get notification preferences error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching notification preferences',
    });
  }
};

/**
 * @desc   Update authenticated user's notification preferences
 * @route  PATCH /api/users/me/notification-preferences
 * @access Private
 */
const updateNotificationPreferences = async (req, res) => {
  try {
    const { newScrapInRegion, newMessages, offers, dealUpdates, reviewReminders } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    if (typeof newScrapInRegion === 'boolean') user.notificationPreferences.newScrapInRegion = newScrapInRegion;
    if (typeof newMessages === 'boolean') user.notificationPreferences.newMessages = newMessages;
    if (typeof offers === 'boolean') user.notificationPreferences.offers = offers;
    if (typeof dealUpdates === 'boolean') user.notificationPreferences.dealUpdates = dealUpdates;
    if (typeof reviewReminders === 'boolean') user.notificationPreferences.reviewReminders = reviewReminders;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      notificationPreferences: user.notificationPreferences,
    });
  } catch (error) {
    console.error('Update notification preferences error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating notification preferences',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deactivateAccount,
  getUserStats,
  getPublicProfile,
  getPublicSellerListings,
  getNotificationPreferences,
  updateNotificationPreferences,
};
