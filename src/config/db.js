const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance using MONGO_URI environment variable.
 * Includes a resilient fallback to MongoMemoryServer in development if local MongoDB is not running.
 */
const connectDB = async () => {
  const connString = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scrapconnect';

  try {
    const conn = await mongoose.connect(connString, { serverSelectionTimeoutMS: 3000 });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB connection failed (${error.message}). Attempting MongoMemoryServer fallback...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      const conn = await mongoose.connect(mongoUri);
      console.log(`🍃 Fallback MongoMemoryServer Connected at ${mongoUri}`);
      return conn;
    } catch (fallbackErr) {
      console.error(`❌ MongoDB Connection Error: ${fallbackErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
