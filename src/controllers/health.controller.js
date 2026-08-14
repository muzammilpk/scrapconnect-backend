const mongoose = require('mongoose');

/**
 * @desc   Health check controller
 * @route  GET /api/health
 * @access Public
 */
const getHealthStatus = (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

  res.status(200).json({
    success: true,
    message: 'ScrapConnect backend is running',
    database: {
      status: dbStateMap[dbState] || 'unknown',
      connected: isDbConnected,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealthStatus,
};
