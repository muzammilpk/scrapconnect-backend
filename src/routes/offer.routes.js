const express = require('express');
const {
  createOffer,
  counterOffer,
  acceptOffer,
  rejectOffer,
  cancelOffer,
  getConversationOffers,
} = require('../controllers/offer.controller');
const { protect, checkNotSuspended } = require('../middleware/auth.middleware');

const router = express.Router();

// All offer endpoints require authentication
router.use(protect);

router.post('/', checkNotSuspended, createOffer);
router.post('/:id/counter', checkNotSuspended, counterOffer);
router.post('/:id/accept', checkNotSuspended, acceptOffer);
router.post('/:id/reject', checkNotSuspended, rejectOffer);
router.post('/:id/cancel', checkNotSuspended, cancelOffer);
router.get('/conversation/:conversationId', getConversationOffers);

module.exports = router;
