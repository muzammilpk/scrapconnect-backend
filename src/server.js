const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/db');

const PORT = config.port;

/**
 * Initialize MongoDB connection first, then start Express server listener.
 */
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start Express server after successful DB connection
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
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
