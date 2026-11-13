/* ==========================================================
   routes/auth.js: /api/auth/* routes (mounted in server.js)
   Only routing and rate limits live here; the logic is in
   controllers/authController.js.
   ========================================================== */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, forgotPassword } = require('../controllers/authController');

const router = express.Router();

// Same JSON shape as every other API error. login.js shows this message to the user.
const tooManyRequests = (req, res) =>
  res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });

// Slows down password guessing: 10 failed logins per 15 minutes per IP.
// skipSuccessfulRequests means normal logins never use up the allowance.
// (In express-rate-limit v6 the `limit` option is called `max`.)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,     // sends the RateLimit-* headers
  legacyHeaders: false,
  handler: tooManyRequests
});

// Stricter, because this endpoint has no password to guess: 5 requests per hour per IP
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests
});

// There is deliberately no registration route: IDs are issued by the admin only.
router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotLimiter, forgotPassword);

module.exports = router;