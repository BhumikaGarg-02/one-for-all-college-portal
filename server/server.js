// 1. Load environment variables FIRST before reading process.env
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// 2. Validate required environment variables
if (!process.env.MONGO_URI) {
  console.error('Configuration error: MONGO_URI environment variable is missing.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('Configuration error: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('Configuration error: JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

// 3. Create Express application
const app = express();
app.disable('x-powered-by');

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 4. Middleware pipeline
// a) Helmet security headers
// Content Security Policy is disabled here because the frontend loads scripts from
// cdnjs.cloudflare.com and unpkg.com, fonts from Google, embeds a Google Maps iframe,
// and utilizes inline style attributes. The default CSP would break these features.
// TODO: replace with a tuned CSP in the hardening step.
app.use(helmet({
  contentSecurityPolicy: false
}));

// b) CORS configuration from CLIENT_ORIGIN
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without Origin (same-origin, curl, server-to-server) or matching allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false
}));

// c) JSON body parser with strict payload size limit
app.use(express.json({ limit: '10kb' }));

// 5. Static frontend file hosting (strictly restricted to public/ directory)
app.use(express.static(path.join(__dirname, '..', 'public')));

// 6. Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Authentication routes (stub router, replaced in subsequent prompts)
app.use('/api/auth', require('./routes/auth'));

// Catch-all for unknown /api/* routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// 7. Error-handling middleware
app.use((err, req, res, next) => {
  // Catch malformed JSON payload errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid request body.' });
  }

  // Log real error on server console only; do not leak stack traces or internals to client
  console.error('Server error:', err);
  return res.status(500).json({ message: 'Something went wrong on our side.' });
});

// 8. Start-up sequence
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message || err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // 9. Graceful shutdown handler
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('MongoDB connection closed.');
      } catch (closeErr) {
        console.error('Error closing MongoDB connection:', closeErr);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
