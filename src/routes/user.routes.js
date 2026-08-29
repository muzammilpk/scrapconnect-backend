const express = require('express');
const { getProfile, updateProfile } = require('../controllers/user.controller');
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

router
  .route('/profile')
  .get(getProfile)
  .put(updateProfile);

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

module.exports = router;
