/* ==========================================================
   jwt.js: creates the login token
   Verifying tokens (verifyToken middleware) comes in the next step.
   ========================================================== */
const jwt = require('jsonwebtoken');

// Builds a signed JWT for a user document.
// The payload only carries what the API needs to identify the user and
// enforce roles. It never contains the password or its hash.
function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');

  const payload = {
    sub: user._id.toString(),                 // database id
    userId: user.userId,                      // STD0001, TEA0001, ADM0001
    role: user.role,                          // student | teacher | admin
    mustChangePassword: user.isFirstLogin     // lets later middleware block everything except the password change
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',                       // set explicitly so the algorithm can never be swapped
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer: 'one-for-all'
  });
}

module.exports = { signToken };