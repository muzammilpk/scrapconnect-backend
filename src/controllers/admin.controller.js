const mongoose = require('mongoose');
const User = require('../models/user.model');
const { Scrap } = require('../models/scrap.model');
const Deal = require('../models/deal.model');
const Review = require('../models/review.model');
const Report = require('../models/report.model');

/**
 * @desc   Get platform dashboard statistics for admin
 * @route  GET /api/admin/dashboard
 * @access Private (Admin only)
 */
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalBuyers,
      totalSellers,
      totalScraps,
      availableScrap,
      reservedScrap,
      soldScrap,
      removedScrap,
      totalDeals,
      completedDeals,
      cancelledDeals,
      totalReviews,
      totalReports,
      pendingReports,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'buyer' }),
      User.countDocuments({ role: 'seller' }),
      Scrap.countDocuments(),
      Scrap.countDocuments({ status: 'available' }),
      Scrap.countDocuments({ status: 'reserved' }),
      Scrap.countDocuments({ status: 'sold' }),
      Scrap.countDocuments({ status: 'removed' }),
      Deal.countDocuments(),
      Deal.countDocuments({ status: 'completed' }),
      Deal.countDocuments({ status: 'cancelled' }),
      Review.countDocuments(),
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        users: totalUsers,
        buyers: totalBuyers,
        sellers: totalSellers,
        scrapListings: totalScraps,
        availableScrap,
        reservedScrap,
        soldScrap,
        removedScrap,
        deals: totalDeals,
        completedDeals,
        cancelledDeals,
        reviews: totalReviews,
        reports: totalReports,
        pendingReports,
      },
    });
  } catch (error) {
    console.error('Admin get stats error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error generating admin stats',
    });
  }
};

/**
 * @desc   Get paginated users list with search & role filter
 * @route  GET /api/admin/users
 * @access Private (Admin only)
 */
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const { search, role, status } = req.query;
    const query = {};

    if (role && ['buyer', 'seller', 'admin'].includes(role)) {
      query.role = role;
    }

    if (status && ['active', 'suspended'].includes(status)) {
      query.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      totalUsers: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      users,
    });
  } catch (error) {
    console.error('Admin get users error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching users',
    });
  }
};

/**
 * @desc   Get user details by ID for admin
 * @route  GET /api/admin/users/:id
 * @access Private (Admin only)
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [scrapsCount, dealsCount, reviewsCount] = await Promise.all([
      Scrap.countDocuments({ seller: id }),
      Deal.countDocuments({ $or: [{ buyer: id }, { seller: id }] }),
      Review.countDocuments({ reviewee: id }),
    ]);

    res.status(200).json({
      success: true,
      user,
      stats: {
        scrapsCount,
        dealsCount,
        reviewsCount,
      },
    });
  } catch (error) {
    console.error('Admin get user by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching user details',
    });
  }
};

/**
 * @desc   Update user status (active / suspended)
 * @route  PATCH /api/admin/users/:id/status
 * @access Private (Admin only)
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be active or suspended',
      });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot suspend their own account',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User account has been ${status === 'suspended' ? 'suspended' : 'activated'}`,
      user,
    });
  } catch (error) {
    console.error('Admin update user status error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating user status',
    });
  }
};

/**
 * @desc   Get paginated scrap listings for admin
 * @route  GET /api/admin/scraps
 * @access Private (Admin only)
 */
const getScraps = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const { search, category, status } = req.query;
    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [scraps, total] = await Promise.all([
      Scrap.find(query)
        .sort({ createdAt: -1 })
        .populate('seller', 'name email role phone location')
        .skip(skip)
        .limit(limit),
      Scrap.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: scraps.length,
      totalScraps: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      scraps,
    });
  } catch (error) {
    console.error('Admin get scraps error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching scrap listings',
    });
  }
};

/**
 * @desc   Get scrap detail by ID for admin
 * @route  GET /api/admin/scraps/:id
 * @access Private (Admin only)
 */
const getScrapById = async (req, res) => {
  try {
    const { id } = req.params;
    const scrap = await Scrap.findById(id).populate('seller', 'name email role phone location');
    if (!scrap) {
      return res.status(404).json({ success: false, message: 'Scrap listing not found' });
    }

    res.status(200).json({
      success: true,
      scrap,
    });
  } catch (error) {
    console.error('Admin get scrap by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching scrap details',
    });
  }
};

/**
 * @desc   Update scrap status (e.g. remove inappropriate listing)
 * @route  PATCH /api/admin/scraps/:id/status
 * @access Private (Admin only)
 */
const updateScrapStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['available', 'reserved', 'sold', 'removed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const scrap = await Scrap.findById(id);
    if (!scrap) {
      return res.status(404).json({ success: false, message: 'Scrap listing not found' });
    }

    scrap.status = status;
    await scrap.save();

    res.status(200).json({
      success: true,
      message: `Scrap status updated to ${status}`,
      scrap,
    });
  } catch (error) {
    console.error('Admin update scrap status error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating scrap status',
    });
  }
};

/**
 * @desc   Get deals list for admin monitoring
 * @route  GET /api/admin/deals
 * @access Private (Admin only)
 */
const getDeals = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const [deals, total] = await Promise.all([
      Deal.find(query)
        .sort({ createdAt: -1 })
        .populate('scrap', 'title category estimatedWeight weightUnit price status location')
        .populate('buyer', 'name email role phone')
        .populate('seller', 'name email role phone')
        .skip(skip)
        .limit(limit),
      Deal.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: deals.length,
      totalDeals: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      deals,
    });
  } catch (error) {
    console.error('Admin get deals error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching deals',
    });
  }
};

/**
 * @desc   Get single deal detail for admin monitoring
 * @route  GET /api/admin/deals/:id
 * @access Private (Admin only)
 */
const getDealById = async (req, res) => {
  try {
    const { id } = req.params;
    const deal = await Deal.findById(id)
      .populate('scrap')
      .populate('buyer', 'name email role phone location')
      .populate('seller', 'name email role phone location')
      .populate('acceptedOffer');

    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    res.status(200).json({
      success: true,
      deal,
    });
  } catch (error) {
    console.error('Admin get deal by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching deal',
    });
  }
};

/**
 * @desc   Get platform reviews list for admin
 * @route  GET /api/admin/reviews
 * @access Private (Admin only)
 */
const getReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find()
        .sort({ createdAt: -1 })
        .populate('reviewer', 'name role email')
        .populate('reviewee', 'name role email')
        .populate({
          path: 'deal',
          select: 'scrap agreedPrice',
          populate: { path: 'scrap', select: 'title' },
        })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      totalReviews: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      reviews,
    });
  } catch (error) {
    console.error('Admin get reviews error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching reviews',
    });
  }
};

/**
 * @desc   Delete policy-violating review
 * @route  DELETE /api/admin/reviews/:id
 * @access Private (Admin only)
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await Review.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Review removed by administrator',
    });
  } catch (error) {
    console.error('Admin delete review error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error removing review',
    });
  }
};

/**
 * @desc   Get user reports for admin moderation
 * @route  GET /api/admin/reports
 * @access Private (Admin only)
 */
const getReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .populate('reporter', 'name email role')
        .populate('reportedUser', 'name email role status')
        .populate('reportedScrap', 'title category status')
        .populate('reportedReview', 'rating comment')
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: reports.length,
      totalReports: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      reports,
    });
  } catch (error) {
    console.error('Admin get reports error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching reports',
    });
  }
};

/**
 * @desc   Update report status & add resolution notes
 * @route  PATCH /api/admin/reports/:id
 * @access Private (Admin only)
 */
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    const validStatuses = ['reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.status = status;
    if (resolutionNotes) report.resolutionNotes = String(resolutionNotes).trim();
    if (status === 'resolved' || status === 'dismissed') {
      report.resolvedAt = new Date();
      report.resolvedBy = req.user._id;
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: `Report status updated to ${status}`,
      report,
    });
  } catch (error) {
    console.error('Admin update report error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating report',
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserStatus,
  getScraps,
  getScrapById,
  updateScrapStatus,
  getDeals,
  getDealById,
  getReviews,
  deleteReview,
  getReports,
  updateReportStatus,
};
