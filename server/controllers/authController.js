/* ==========================================================
   authController.js: login and forgot-password handlers
   Follows the API contract used by public/js/login.js:
     POST /api/auth/login            -> { token, role, mustChangePassword }
     POST /api/auth/forgot-password  -> always the same 200 message
   ========================================================== */
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');

const ID_PATTERN = /^(STD|TEA|ADM)\d{4}$/;
const ROLES = ['student', 'teacher', 'admin'];

// ONE message for every credential failure (unknown ID, wrong password, wrong role tab),
// so an attacker can never tell which part was wrong.
const BAD_CREDENTIALS = 'Incorrect ID or password.';

// Timing-attack protection: when the ID does not exist we still run a bcrypt
// comparison against this throwaway hash, so "unknown ID" takes as long as
// "wrong password". It uses the same cost as the real hashes (BCRYPT_ROUNDS),
// and is created once when the server starts.
const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

// Passes errors from async handlers to the global error handler in server.js
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Returns the cleaned-up ID (trimmed, upper case) or null if it is not a valid ID.
// Because the result must match the strict pattern, it is always a safe plain
// string by the time it reaches a database query.
function normalizeUserId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim().toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

/* ---------- POST /api/auth/login ---------- */
const login = asyncHandler(async (req, res) => {
  const { userId: rawId, password, role } = req.body || {};

  // 1) Basic request validation (the frontend checks too, but never trust the client)
  const userId = normalizeUserId(rawId);
  const validPassword = typeof password === 'string' && password.length >= 1 && password.length <= 128;
  if (!userId || !ROLES.includes(role) || !validPassword) {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  // 2) Look the user up. The password hash is hidden by default, so ask for it explicitly.
  const user = await User.findOne({ userId }).select('+password');

  // 3) Always run one bcrypt comparison, even for unknown IDs (see DUMMY_HASH above)
  const hash = user && user.password ? user.password : DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);

  // 4) Unknown ID, wrong password and wrong role tab all get the same answer
  if (!user || !passwordMatches || user.role !== role) {
    return res.status(401).json({ message: BAD_CREDENTIALS });
  }

  // 5) Only now, with the password proven correct, is it safe to say the account is disabled
  if (user.isActive === false) {
    return res.status(403).json({ message: 'This account is disabled. Please contact the admin office.' });
  }

  // 6) Record the login time. updateOne (not save) keeps the password-hash hook out of it,
  //    and a failure here must not block a valid login.
  try {
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  } catch (err) {
    console.error('Could not update lastLoginAt:', err.message);
  }

  // 7) Success: exactly the three fields the frontend expects, nothing more
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({
    token: signToken(user),
    role: user.role,
    mustChangePassword: user.isFirstLogin
  });
});

/* ---------- POST /api/auth/forgot-password ---------- */
const forgotPassword = asyncHandler(async (req, res) => {
  const userId = normalizeUserId((req.body || {}).userId);
  if (!userId) {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  // TODO (Admin dashboard step): save this request so the admin can see it and reset the
  // password. For now nothing is stored and no email is sent. We do not even look the ID up,
  // so the response and its timing are identical whether or not the ID exists.
  return res.status(200).json({
    message: 'If this ID exists, the admin office has been notified.'
  });
});

module.exports = { login, forgotPassword };