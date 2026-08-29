const express = require('express');
const {
  getProfile,
  updateProfile,
  deactivateAccount,
  getUserStats,
  getPublicProfile,
  getPublicSellerListings,
} = require('../controllers/user.controller');
const {
  getServiceRegions,
  addServiceRegion,
  updateServiceRegion,
  deleteServiceRegion,
} = require('../controllers/buyer.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all routes in user module
router.use(protect);

// Private profile management
router
  .route('/profile')
  .get(getProfile)
  .put(updateProfile)
  .patch(updateProfile);

router
  .route('/me')
  .get(getProfile)
  .patch(updateProfile)
  .put(updateProfile);

router.get('/me/stats', getUserStats);
router.patch('/me/status', deactivateAccount);

// Buyer Service Regions routes at /api/users/me/service-regions
router
  .route('/me/service-regions')
  .get(authorize('buyer'), getServiceRegions)
  .post(authorize('buyer'), addServiceRegion);

router
  .route('/me/service-regions/:id')
  .patch(authorize('buyer'), updateServiceRegion)
  .put(authorize('buyer'), updateServiceRegion)
  .delete(authorize('buyer'), deleteServiceRegion);

// Public profile & listings routes
router.get('/:id/profile', getPublicProfile);
router.get('/:id/listings', getPublicSellerListings);

module.exports = router;
