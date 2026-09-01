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
const { validateObjectId } = require('../middleware/validate.middleware');
const { strictActionLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// All offer endpoints require authentication
router.use(protect);

router.post('/', checkNotSuspended, strictActionLimiter, createOffer);
router.post('/:id/counter', validateObjectId('id'), checkNotSuspended, strictActionLimiter, counterOffer);
router.post('/:id/accept', validateObjectId('id'), checkNotSuspended, acceptOffer);
router.post('/:id/reject', validateObjectId('id'), checkNotSuspended, rejectOffer);
router.post('/:id/cancel', validateObjectId('id'), checkNotSuspended, cancelOffer);
router.get('/conversation/:conversationId', validateObjectId('conversationId'), getConversationOffers);

module.exports = router;
