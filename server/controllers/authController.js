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

/* ---------- POST /api/auth/change-password ----------
   Used for the forced change on first login and for any later change.
   The route runs verifyToken first, so req.user is the signed-in user. */

// Passwords containing any of these are guessed first by attackers, so they are refused
const WEAK_WORDS = ['password', 'qwerty', '123456', 'letmein', 'changeme', 'admin123', 'oneforall', 'welcome'];

// Returns a list of problems (an empty list means the password is acceptable).
// Keep these rules in sync with public/js/change-password.js, which shows them live.
function passwordProblems(password, userId) {
  const problems = [];

  // bcrypt only reads the first 72 BYTES, so cap the length instead of silently ignoring the rest
  if (password.length < 8 || password.length > 64 || Buffer.byteLength(password, 'utf8') > 72) {
    problems.push('Use 8 to 64 characters.');
  }
  if (!/[a-z]/.test(password)) problems.push('Add a lower-case letter.');
  if (!/[A-Z]/.test(password)) problems.push('Add an upper-case letter.');
  if (!/\d/.test(password)) problems.push('Add a number.');
  if (!/[^A-Za-z0-9\s]/.test(password)) problems.push('Add a special character, like ! @ # $ %.');
  if (/\s/.test(password)) problems.push('Do not use spaces.');
  if (password.toUpperCase().includes(userId)) problems.push('Do not include your ID in the password.');
  if (WEAK_WORDS.some(word => password.toLowerCase().includes(word))) {
    problems.push('Avoid common words like "password" or "welcome".');
  }
  return problems;
}

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  // 1) Both values must be strings of a sane size
  const sane = value => typeof value === 'string' && value.length >= 1 && value.length <= 128;
  if (!sane(currentPassword) || !sane(newPassword)) {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  // 2) Load the account with its hash (verifyToken has already rejected disabled accounts)
  const user = await User.findById(req.user.id).select('+password');
  if (!user || !user.password) {
    return res.status(401).json({ message: 'Invalid session. Please sign in again.' });
  }

  // 3) The current (or temporary) password must be right. This is a 400, not a 401, so the
  //    frontend can tell "typo" from "session expired". The route's rate limiter counts these.
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    res.locals.wrongCurrentPassword = true;
    return res.status(400).json({ message: 'Your current password is incorrect.', code: 'WRONG_CURRENT_PASSWORD' });
  }

  // 4) Strength rules, and it must really be a NEW password
  const problems = passwordProblems(newPassword, user.userId);
  if (newPassword === currentPassword) problems.push('Choose a password different from your current one.');
  if (problems.length) {
    return res.status(400).json({ message: 'Please choose a stronger password.', code: 'WEAK_PASSWORD', problems });
  }

  // 5) Save through the model (never updateOne), so the pre-save hook hashes the new password.
  //    passwordChangedAt is also set here as a safety net: it is what ends every older session.
  //    validateModifiedOnly stops an unrelated old field from blocking the save.
  user.password = newPassword;
  user.isFirstLogin = false;
  user.passwordChangedAt = new Date();
  await user.save({ validateModifiedOnly: true });

  // 6) Older tokens stop working now (see verifyToken), so hand back a fresh one.
  //    It is signed AFTER the save, so its issue time is never earlier than passwordChangedAt.
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({
    message: 'Password updated.',
    token: signToken(user),
    role: user.role,
    mustChangePassword: user.isFirstLogin   // false now
  });
});

module.exports = { login, forgotPassword, changePassword };