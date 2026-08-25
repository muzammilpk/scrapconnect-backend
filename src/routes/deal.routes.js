const express = require('express');
const {
  createDeal,
  getDeals,
  getDealById,
  updateDealStatus,
  updatePickupDetails,
} = require('../controllers/deal.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All deal routes require authentication
router.use(protect);

router.post('/', createDeal);
router.get('/', getDeals);
router.get('/:id', getDealById);
router.patch('/:id/status', updateDealStatus);
router.patch('/:id/pickup', updatePickupDetails);

module.exports = router;
