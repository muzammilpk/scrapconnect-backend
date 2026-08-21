const http = require('http');
const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/db');
const { initSocketServer } = require('./socket/chatSocket');

const PORT = config.port;

/**
 * Initialize MongoDB connection first, then start HTTP server & Socket.IO listener.
 */
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Create HTTP server & Socket.IO instance
    const server = http.createServer(app);
    initSocketServer(server);

    // 3. Start server listener
    server.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 ScrapConnect Backend Server');
      console.log(`📡 Environment: ${config.nodeEnv}`);
      console.log(`🌐 Running on: http://localhost:${PORT}`);
      console.log('💬 Real-time Socket.IO chat enabled');
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
