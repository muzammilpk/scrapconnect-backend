const express = require('express');
const {
  getServiceRegions,
  addServiceRegion,
  updateServiceRegion,
  deleteServiceRegion,
} = require('../controllers/buyer.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all routes: must be authenticated and must have role 'buyer'
router.use(protect);
router.use(authorize('buyer'));

router
  .route('/service-regions')
  .get(getServiceRegions)
  .post(addServiceRegion);

router
  .route('/service-regions/:regionId')
  .put(updateServiceRegion)
  .delete(deleteServiceRegion);

module.exports = router;
