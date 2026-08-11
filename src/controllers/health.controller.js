/**
 * @desc   Health check controller
 * @route  GET /api/health
 * @access Public
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    message: "ScrapConnect backend is running",
  });
};

module.exports = {
  getHealthStatus,
};
