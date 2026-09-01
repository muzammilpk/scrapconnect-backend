const express = require('express');
const {
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
} = require('../controllers/admin.controller');
const { protect, requireAdmin } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validate.middleware');

const router = express.Router();

// Enforce authentication & Admin role authorization for all admin routes
router.use(protect);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.get('/users/:id', validateObjectId('id'), getUserById);
router.patch('/users/:id/status', validateObjectId('id'), updateUserStatus);

// Scrap Moderation
router.get('/scraps', getScraps);
router.get('/scraps/:id', validateObjectId('id'), getScrapById);
router.patch('/scraps/:id/status', validateObjectId('id'), updateScrapStatus);

// Deal Monitoring
router.get('/deals', getDeals);
router.get('/deals/:id', validateObjectId('id'), getDealById);

// Review Moderation
router.get('/reviews', getReviews);
router.delete('/reviews/:id', validateObjectId('id'), deleteReview);

// Report Management
router.get('/reports', getReports);
router.patch('/reports/:id', validateObjectId('id'), updateReportStatus);

module.exports = router;
