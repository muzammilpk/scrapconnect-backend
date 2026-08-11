const app = require('./app');
const config = require('./config/env');

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 ScrapConnect Backend Server');
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Running on: http://localhost:${PORT}`);
  console.log('=================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});
