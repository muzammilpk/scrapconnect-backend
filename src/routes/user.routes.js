const express = require('express');
const {
  getProfile,
  updateProfile,
  deactivateAccount,
  getUserStats,
  getPublicProfile,
  getPublicSellerListings,
  getNotificationPreferences,
  updateNotificationPreferences,
} = require('../controllers/user.controller');
const {
  getServiceRegions,
  addServiceRegion,
  updateServiceRegion,
  deleteServiceRegion,
} = require('../controllers/buyer.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validate.middleware');

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

router
  .route('/me/notification-preferences')
  .get(getNotificationPreferences)
  .patch(updateNotificationPreferences);

// Buyer Service Regions routes at /api/users/me/service-regions
router
  .route('/me/service-regions')
  .get(authorize('buyer'), getServiceRegions)
  .post(authorize('buyer'), addServiceRegion);

router
  .route('/me/service-regions/:id')
  .patch(authorize('buyer'), validateObjectId('id'), updateServiceRegion)
  .put(authorize('buyer'), validateObjectId('id'), updateServiceRegion)
  .delete(authorize('buyer'), validateObjectId('id'), deleteServiceRegion);

// Public profile & listings routes
router.get('/:id/profile', validateObjectId('id'), getPublicProfile);
router.get('/:id/listings', validateObjectId('id'), getPublicSellerListings);

module.exports = router;
