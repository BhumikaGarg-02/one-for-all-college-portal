/* ==========================================================
   server.js: Express entry point for ONE FOR ALL
   Start with:  npm run dev   (or: node server/server.js)
   ========================================================== */

// 1) Load .env FIRST, before any other file reads process.env
require('dotenv').config({ quiet: true });   // quiet: newer dotenv versions otherwise print a tip on every start

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');

const adminRoutes = require('./routes/admin');
const queryRoutes = require('./routes/queries');
const authRoutes = require('./routes/auth');
const { verifyToken } = require('./middleware/authMiddleware');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
let server;   // set in start(), used by the shutdown handler

/* ---------- 2) App setup ---------- */
app.disable('x-powered-by');                               // don't advertise "Express"
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);                               // behind a proxy, so rate limiting sees real client IPs
}

// Security headers. The default Content-Security-Policy is switched off because the frontend loads
// scripts from cdnjs.cloudflare.com and unpkg.com, fonts from Google, a Google Maps iframe, and uses
// inline style attributes. TODO: replace with a tuned policy in the hardening step.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: only matters when the page is NOT served by this server (for example Live Server on port 5500).
// Requests from the site itself have no Origin header and always pass.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

app.use(express.json({ limit: '10kb' }));                  // small limit: no login or form needs more

// The frontend. Only the public/ folder is exposed, so server/, .env and uploads/ can never be downloaded.
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------- 3) API routes ---------- */
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/admin', adminRoutes); 
app.use('/api/queries', queryRoutes);
app.use('/api/auth', authRoutes);

// "Who am I?" Dashboards will call this to check the saved token and learn the role.
// It only needs a valid login, so it also works while the password change is still pending.
app.get('/api/me', verifyToken, (req, res) => {
  res.json({
    userId: req.user.userId,
     name: req.user.name,
    role: req.user.role,
    mustChangePassword: req.user.mustChangePassword
  });
});

// Any other /api path
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

/* ---------- 4) Error handler (must be last) ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Errors raised by express.json()
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });

  // Anything else is our bug: log the details here, tell the client nothing
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong on our side.' });
});

/* ---------- 5) Start-up ---------- */
// Refuse to start with missing or weak settings
function checkEnvironment() {
  const problems = [];
  if (!process.env.MONGO_URI) problems.push('MONGO_URI is missing');
  if (!process.env.JWT_SECRET) problems.push('JWT_SECRET is missing');
  else if (process.env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters');

  if (problems.length) {
    console.error('Cannot start the server:\n - ' + problems.join('\n - '));
    console.error('Check your .env file (see .env.example).');
    process.exit(1);
  }
}

async function connectDatabase() {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', err => console.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

  // serverSelectionTimeoutMS: a wrong address fails after 5 seconds instead of hanging
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected: ${host}/${name}`);   // never print the full URI, it can contain a password
}

async function start() {
  checkEnvironment();
  await connectDatabase();

  server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  server.on('error', err => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use.` : `Server error: ${err.message}`);
    process.exit(1);
  });
}

// Stop accepting requests, close the database, then exit
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  const forceExit = setTimeout(() => process.exit(1), 10000);   // safety net if something hangs
  forceExit.unref();

  const finish = async () => {
    await mongoose.disconnect();
    process.exit(0);
  };
  if (server) server.close(finish); else finish();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', reason => console.error('Unhandled promise rejection:', reason));

// Only start when run directly (node server/server.js). Requiring this file, for example
// from a test, just gives you the app without opening a port or a database connection.
if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = app;