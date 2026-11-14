/* ==========================================================
   adminController.js: user management for the Admin dashboard
     GET   /api/admin/summary                       counts for the stat cards
     GET   /api/admin/users                         search / filter / page
     POST  /api/admin/users                         create the next free ID
     PATCH /api/admin/users/:userId/status         enable or disable
     POST  /api/admin/users/:userId/reset-password  new temporary password

   Every route is behind protect('admin') (see routes/admin.js).
   Passwords: a temporary password is returned ONCE in the response
   and is never stored in readable form or written to any log.
   ========================================================== */
const User = require('../models/User');
const { generateTempPassword } = require('../utils/tempPassword');

const ID_PATTERN = /^(STD|TEA|ADM)\d{4}$/;
const ROLES = ['student', 'teacher', 'admin'];
const STATUSES = ['active', 'disabled', 'pending'];       // pending = has not signed in yet to set a password

// The admin can create students and teachers here. Extra admins are made with the seed
// script on purpose: a stolen admin session must not be able to create more admins.
const PREFIX = { student: 'STD', teacher: 'TEA' };

// Only these fields ever leave the server (the password hash is never selected)
const PUBLIC_FIELDS = 'userId name role isActive isFirstLogin lastLoginAt createdAt';

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const badRequest = (res, message = 'Invalid request.', code) =>
  res.status(400).json(code ? { message, code } : { message });

// A short line for the server log: who did what to whom. Never include passwords here.
function audit(req, action, target) {
  console.log(`[audit] ${new Date().toISOString()} ${req.user.userId} ${action} ${target}`);
}

// What the frontend gets for one account
function toPublic(user) {
  return {
    userId: user.userId,
    name: user.name || '',
    role: user.role,
    isActive: user.isActive !== false,
    isFirstLogin: user.isFirstLogin === true,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null
  };
}

function normalizeUserId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim().toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

// Letters (any language), spaces and . ' - only, 2 to 80 characters. Returns null if not acceptable.
function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) return null;
  return /^\p{L}[\p{L}\p{M}.' -]*$/u.test(name) ? name : null;
}

// Makes user-typed search text safe to use inside a regular expression
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- GET /api/admin/summary ---------- */
const getSummary = asyncHandler(async (req, res) => {
  const [students, teachers, admins, disabled, awaitingFirstLogin] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'teacher' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ isActive: false }),
    User.countDocuments({ isFirstLogin: true })
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ students, teachers, admins, disabled, awaitingFirstLogin });
});

/* ---------- GET /api/admin/users?role=&status=&q=&page=&limit= ---------- */
const listUsers = asyncHandler(async (req, res) => {
  const { role, status, q, page: rawPage, limit: rawLimit } = req.query;

  // Query-string values can be arrays or objects (?role[$ne]=x), so only plain strings are accepted
  const isText = v => v === undefined || typeof v === 'string';
  if (![role, status, q, rawPage, rawLimit].every(isText)) return badRequest(res);
  if (role && !ROLES.includes(role)) return badRequest(res);
  if (status && !STATUSES.includes(status)) return badRequest(res);

  const page = rawPage === undefined ? 1 : Number(rawPage);
  const limit = rawLimit === undefined ? PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(page) || page < 1 || page > 100000) return badRequest(res);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return badRequest(res);

  const filter = {};
  if (role) filter.role = role;
  if (status === 'active') filter.isActive = { $ne: false };
  if (status === 'disabled') filter.isActive = false;
  if (status === 'pending') filter.isFirstLogin = true;

  const search = (q || '').trim().slice(0, 50);
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { userId: { $regex: pattern, $options: 'i' } },
      { name: { $regex: pattern, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter).select(PUBLIC_FIELDS).sort({ userId: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter)
  ]);

  res.set('Cache-Control', 'no-store');
  res.json({ items: items.map(toPublic), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
});

/* ---------- POST /api/admin/users ---------- */
// Finds the next free number for a role: one more than the highest existing ID.
// Gaps are fine and IDs are never reused. IDs are fixed width, so sorting them as text
// gives the right order.
async function nextUserId(prefix) {
  const last = await User.findOne({ userId: new RegExp(`^${prefix}\\d{4}$`) })
    .sort({ userId: -1 }).select('userId').lean();
  const next = last ? parseInt(last.userId.slice(3), 10) + 1 : 1;
  return next > 9999 ? null : prefix + String(next).padStart(4, '0');
}

const createUser = asyncHandler(async (req, res) => {
  const { role, name } = req.body || {};

  // typeof matters: an array like ["student"] would otherwise be turned into the text "student"
  if (typeof role !== 'string' || !Object.prototype.hasOwnProperty.call(PREFIX, role)) {
    return badRequest(res, 'Choose Student or Teacher.', 'INVALID_ROLE');
  }
  const fullName = cleanName(name);
  if (!fullName) {
    return badRequest(res, 'Enter the full name (2 to 80 letters, spaces, . - and apostrophes).', 'INVALID_NAME');
  }

  const temporaryPassword = generateTempPassword();
  let user = null;

  // Two admins creating at the same moment could pick the same number. The unique index on
  // userId stops the second one (error 11000), so it simply tries again with the next number.
  for (let attempt = 0; attempt < 5 && !user; attempt++) {
    const userId = await nextUserId(PREFIX[role]);
    if (!userId) {
      return res.status(409).json({ message: `All ${PREFIX[role]} IDs are used up.`, code: 'IDS_EXHAUSTED' });
    }
    try {
      // create() runs the model's password-hashing hook, same as the seed script
      user = await User.create({ userId, name: fullName, role, password: temporaryPassword, isFirstLogin: true, isActive: true });
    } catch (err) {
      if (err && err.code === 11000) continue;                 // number taken a moment ago: try the next one
      if (err && err.name === 'ValidationError') return badRequest(res, 'Please check the details and try again.');
      throw err;
    }
  }
  if (!user) {
    return res.status(409).json({ message: 'Could not reserve an ID. Please try again.', code: 'ID_CONFLICT' });
  }

  audit(req, 'create-user', user.userId);
  res.set('Cache-Control', 'no-store');
  return res.status(201).json({ user: toPublic(user), temporaryPassword });
});

/* ---------- PATCH /api/admin/users/:userId/status  { isActive: true|false } ---------- */
const setUserStatus = asyncHandler(async (req, res) => {
  const userId = normalizeUserId(req.params.userId);
  const { isActive } = req.body || {};
  if (!userId || typeof isActive !== 'boolean') return badRequest(res);

  // Disabling yourself could lock everyone out of the admin area
  if (userId === req.user.userId) {
    return res.status(403).json({ message: 'You cannot change the status of your own account.', code: 'SELF_ACTION' });
  }

  const result = await User.updateOne({ userId }, { $set: { isActive } });
  if (!result.matchedCount) return res.status(404).json({ message: 'User not found.' });

  // No session clean-up is needed: verifyToken checks isActive on every request,
  // so a disabled account is locked out immediately.
  audit(req, isActive ? 'enable-user' : 'disable-user', userId);
  return res.json({ userId, isActive });
});

/* ---------- POST /api/admin/users/:userId/reset-password ---------- */
const resetPassword = asyncHandler(async (req, res) => {
  const userId = normalizeUserId(req.params.userId);
  if (!userId) return badRequest(res);

  if (userId === req.user.userId) {
    return res.status(403).json({
      message: 'Use "Change password" in your own profile to change your password.',
      code: 'SELF_ACTION'
    });
  }

  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  // Save through the model so the pre-save hook hashes the password.
  // passwordChangedAt ends every session the person already has;
  // isFirstLogin sends them to the change-password page next time they sign in.
  const temporaryPassword = generateTempPassword();
  user.password = temporaryPassword;
  user.isFirstLogin = true;
  user.passwordChangedAt = new Date();
  await user.save({ validateModifiedOnly: true });

  audit(req, 'reset-password', userId);
  res.set('Cache-Control', 'no-store');
  return res.json({ userId, temporaryPassword });
});

module.exports = { getSummary, listUsers, createUser, setUserStatus, resetPassword };