const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const buyerRoutes = require('./buyer.routes');
const scrapRoutes = require('./scrap.routes');
const notificationRoutes = require('./notification.routes');
const chatRoutes = require('./chat.routes');

const router = express.Router();

// Mount route modules
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/buyers', buyerRoutes);
router.use('/scraps', scrapRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes);

module.exports = router;
