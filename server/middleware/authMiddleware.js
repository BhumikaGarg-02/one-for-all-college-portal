/* ==========================================================
   authMiddleware.js: protects API routes
   ----------------------------------------------------------
   verifyToken            who are you?       (401 if not signed in)
   requirePasswordChanged have you set your own password? (403 if still on the admin-issued one)
   restrictTo(...roles)   are you allowed?   (403 if your role is not listed)
   protect(...roles)      all three in one, the safe default for new routes

   Typical use in a router:
     const { protect, verifyToken } = require('../middleware/authMiddleware');
     router.use(protect('student'));                        // every route below is student-only
     router.post('/change-password', verifyToken, handler); // needs a login, but NOT the password change
   ========================================================== */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const VALID_ROLES = ['student', 'teacher', 'admin'];
const COOKIE_NAME = 'ofa_token';   // only used if you later decide to store the token in a cookie

// Passes errors from async middleware to the global error handler in server.js
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 401 = "we don't know who you are". The WWW-Authenticate header is part of the HTTP standard for 401.
function unauthorized(res, message) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({ message });
}

/* ---------- Finding the token ---------- */

// Reads one cookie from the raw Cookie header (so no extra cookie-parser package is needed)
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch (err) {
      return null;   // broken %-encoding: treat as "no cookie" instead of crashing
    }
  }
  return null;
}

// Order: "Authorization: Bearer <token>" first (what public/js/login.js uses), then the cookie.
// If an Authorization header is present but malformed we do NOT fall back to the cookie.
function extractToken(req) {
  const header = req.headers.authorization;
  if (header) {
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    return match ? match[1] : null;
  }
  return readCookie(req, COOKIE_NAME);
}

/* ---------- verifyToken ---------- */
const verifyToken = asyncHandler(async (req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');   // a server mistake: becomes a 500, not a misleading 401

  const token = extractToken(req);
  if (!token || token.length > 2048) {
    return unauthorized(res, 'Please sign in to continue.');
  }

  // 1) Check the signature, expiry, issuer and algorithm. Allowing only HS256 blocks
  //    "alg: none" and algorithm-swap tricks.
  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'one-for-all' });
  } catch (err) {
    return unauthorized(
      res,
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please sign in again.'
        : 'Invalid session. Please sign in again.'
    );
  }

  // 2) Check the account as it is NOW, not as it was when the token was issued.
  //    This is what lets the admin disable an account or change a role immediately.
  const user = await User.findById(payload.sub).select('userId name role isActive isFirstLogin passwordChangedAt');
  if (!user) {
    return unauthorized(res, 'Invalid session. Please sign in again.');
  }
  if (user.isActive === false) {
    return res.status(403).json({ message: 'This account is disabled. Please contact the admin office.' });
  }

  // 3) A password change ends every older session. "iat" is in seconds, so compare in seconds.
  if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
    return unauthorized(res, 'Your password was changed. Please sign in again.');
  }

  // 4) Everything later handlers need. The values come from the database, not from the token.
  req.user = {
    id: user._id.toString(),
    userId: user.userId,
    name: user.name,
    role: user.role,
    mustChangePassword: user.isFirstLogin === true
  };
  next();
});

/* ---------- requirePasswordChanged ---------- */
// Blocks users who still have the temporary admin-issued password. The frontend can
// look for code "PASSWORD_CHANGE_REQUIRED" and send them to change-password.html.
function requirePasswordChanged(req, res, next) {
  if (!req.user) return unauthorized(res, 'Please sign in to continue.');
  if (req.user.mustChangePassword) {
    return res.status(403).json({
      message: 'Please change your temporary password before continuing.',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }
  next();
}

/* ---------- restrictTo ---------- */
// restrictTo('admin')  or  restrictTo('teacher', 'admin'). Must run AFTER verifyToken.
function restrictTo(...roles) {
  // Fail loudly when the route is written, so a typo like 'Admin' cannot silently lock everyone out
  if (roles.length === 0 || roles.some(role => !VALID_ROLES.includes(role))) {
    throw new Error(`restrictTo: pass one or more of ${VALID_ROLES.join(', ')}`);
  }

  return (req, res, next) => {
    if (!req.user) return unauthorized(res, 'Please sign in to continue.');   // verifyToken did not run
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do that.' });
    }
    next();
  };
}

/* ---------- protect ---------- */
// The safe default for dashboards: signed in + password already changed + (optionally) right role.
// protect() with no roles means "any signed-in user who has changed their password".
function protect(...roles) {
  const chain = [verifyToken, requirePasswordChanged];
  if (roles.length) chain.push(restrictTo(...roles));
  return chain;   // Express accepts an array of middleware, e.g. router.use(protect('admin'))
}

module.exports = { verifyToken, requirePasswordChanged, restrictTo, protect };