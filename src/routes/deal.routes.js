const express = require('express');
const {
  createDeal,
  getDeals,
  getDealById,
  updateDealStatus,
  updatePickupDetails,
} = require('../controllers/deal.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validate.middleware');

const router = express.Router();

// All deal routes require authentication
router.use(protect);

router.post('/', createDeal);
router.get('/', getDeals);
router.get('/:id', validateObjectId('id'), getDealById);
router.patch('/:id/status', validateObjectId('id'), updateDealStatus);
router.patch('/:id/pickup', validateObjectId('id'), updatePickupDetails);

module.exports = router;
