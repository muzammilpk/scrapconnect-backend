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

const router = express.Router();

// Enforce authentication & Admin role authorization for all admin routes
router.use(protect);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', updateUserStatus);

// Scrap Moderation
router.get('/scraps', getScraps);
router.get('/scraps/:id', getScrapById);
router.patch('/scraps/:id/status', updateScrapStatus);

// Deal Monitoring
router.get('/deals', getDeals);
router.get('/deals/:id', getDealById);

// Review Moderation
router.get('/reviews', getReviews);
router.delete('/reviews/:id', deleteReview);

// Report Management
router.get('/reports', getReports);
router.patch('/reports/:id', updateReportStatus);

module.exports = router;
