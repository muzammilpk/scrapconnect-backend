const express = require('express');
const {
  createOffer,
  counterOffer,
  acceptOffer,
  rejectOffer,
  cancelOffer,
  getConversationOffers,
} = require('../controllers/offer.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All offer endpoints require authentication
router.use(protect);

router.post('/', createOffer);
router.post('/:id/counter', counterOffer);
router.post('/:id/accept', acceptOffer);
router.post('/:id/reject', rejectOffer);
router.post('/:id/cancel', cancelOffer);
router.get('/conversation/:conversationId', getConversationOffers);

module.exports = router;
