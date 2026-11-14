/* ==========================================================
   routes/admin.js: /api/admin/* (mounted in server.js)
   The whole router is admin-only: protect('admin') runs before
   every route below, so a student or teacher token gets a 403
   and no token gets a 401.
   ========================================================== */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const {
  getSummary, listUsers, createUser, setUserStatus, resetPassword
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect('admin'));

// A stolen admin token could mass-create or mass-reset accounts, so writes are limited:
// 120 per 15 minutes per admin account. Normal use stays far below this.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: req => req.user.id,            // set by protect(), which runs first
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ message: 'Too many changes in a short time. Please wait a few minutes.' })
});

router.get('/summary', getSummary);
router.get('/users', listUsers);
router.post('/users', writeLimiter, createUser);
router.patch('/users/:userId/status', writeLimiter, setUserStatus);
router.post('/users/:userId/reset-password', writeLimiter, resetPassword);

module.exports = router;