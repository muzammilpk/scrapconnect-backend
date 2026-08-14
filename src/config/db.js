const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance using MONGO_URI environment variable.
 */
const connectDB = async () => {
  try {
    const connString = process.env.MONGO_URI;
    
    if (!connString) {
      throw new Error('MONGO_URI is not defined in environment variables.');
    }

    const conn = await mongoose.connect(connString);

    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
