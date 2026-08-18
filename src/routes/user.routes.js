const express = require('express');
const { getProfile, updateProfile } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all routes in user module
router.use(protect);

router
  .route('/profile')
  .get(getProfile)
  .put(updateProfile);

module.exports = router;
