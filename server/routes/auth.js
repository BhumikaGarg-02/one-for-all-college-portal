/* ==========================================================
   routes/auth.js: /api/auth/* routes (mounted in server.js)
   Only routing and rate limits live here; the logic is in
   controllers/authController.js.
   ========================================================== */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, forgotPassword, changePassword } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Same JSON shape as every other API error. The frontend shows this message to the user.
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

// Someone holding a stolen token could try to guess the current password here, so wrong guesses
// are limited: 5 per 15 minutes per ACCOUNT (not per IP, so a shared college network is not
// affected). Only wrong-current-password answers count: the controller sets
// res.locals.wrongCurrentPassword, and everything else is refunded.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => !res.locals.wrongCurrentPassword,
  keyGenerator: req => req.user.id,   // set by verifyToken, which runs first
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests
});

// There is deliberately no registration route: IDs are issued by the admin only.
router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotLimiter, forgotPassword);

// verifyToken only (not protect): a user who still has the temporary password must be able to reach this
router.post('/change-password', verifyToken, changePasswordLimiter, changePassword);

module.exports = router;