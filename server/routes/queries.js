/* ==========================================================
   routes/queries.js: /api/queries/* (mounted in server.js)
   protect('student') / protect('teacher') run before the handler,
   so the wrong role gets a 403 and no login gets a 401.
   ========================================================== */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const {
  createQuery, listMine, listInbox, replyToQuery, getSummary
} = require('../controllers/queryController');

const router = express.Router();

const tooMany = message => (req, res) => res.status(429).json({ message });

// Stops spamming: a student can send 10 questions per hour. Counted per account, not per IP,
// so a shared college network is not affected. Only questions that were really sent count:
// a rejected attempt (for example "subject too short") does not use up the allowance.
const askLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skipFailedRequests: true,
  keyGenerator: req => req.user.id,          // set by protect(), which runs first
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('You have asked a lot of questions in a short time. Please wait a little before sending another.')
});

const replyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  keyGenerator: req => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many replies in a short time. Please wait a few minutes.')
});

// Students
router.post('/', protect('student'), askLimiter, createQuery);
router.get('/mine', protect('student'), listMine);

// Teachers
router.get('/inbox', protect('teacher'), listInbox);
router.post('/:id/reply', protect('teacher'), replyLimiter, replyToQuery);

// Both (the controller returns the right numbers for each role)
router.get('/summary', protect('student', 'teacher'), getSummary);

module.exports = router;