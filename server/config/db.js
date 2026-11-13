const mongoose = require('mongoose');

/**
 * Establish connection to MongoDB instance.
 * Throws if the initial connection fails so the server process can exit cleanly.
 */
async function connectDB() {
  mongoose.set('strictQuery', true);

  // Monitor subsequent connection events
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message || err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    // Log host and database name safely without exposing credentials
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    // Re-throw so caller can handle fatal connection startup failure
    throw err;
  }
}

module.exports = connectDB;
