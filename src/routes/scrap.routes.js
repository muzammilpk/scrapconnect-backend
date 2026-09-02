const express = require('express');
const {
  uploadImages,
  createScrap,
  getMyScrapListings,
  getAllScraps,
  getScrapById,
  updateScrap,
  deleteScrap,
  getMatchingBuyersForScrap,
} = require('../controllers/scrap.controller');
const { protect, authorize, checkNotSuspended } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

// All scrap endpoints require authentication
router.use(protect);

// Marketplace query endpoint (GET /api/scraps & /api/scraps/marketplace)
router.get('/', getAllScraps);
router.get('/marketplace', getAllScraps);

// Seller-only endpoints
router.post('/upload', authorize('seller'), checkNotSuspended, upload.array('images', 5), uploadImages);
router.post('/', authorize('seller'), checkNotSuspended, createScrap);
router.get('/my-listings', authorize('seller'), getMyScrapListings);
router.get('/:id/matching-buyers', authorize('seller'), validateObjectId('id'), getMatchingBuyersForScrap);

// Individual scrap listing operations
router
  .route('/:id')
  .get(validateObjectId('id'), getScrapById)
  .put(validateObjectId('id'), authorize('seller'), checkNotSuspended, updateScrap)
  .patch(validateObjectId('id'), authorize('seller'), checkNotSuspended, updateScrap)
  .delete(validateObjectId('id'), authorize('seller'), checkNotSuspended, deleteScrap);

module.exports = router;
