/* ==========================================================
   utils/tempPassword.js: temporary passwords for new accounts
   and admin resets.

   Looks like  Kq7m-Xt3p-Wn9R  (12 characters in 3 groups).
   - Made with crypto.randomInt, which is safe for secrets
     (Math.random is NOT, never use it for passwords).
   - Confusing characters are left out (O, 0, I, l, 1), so it
     can be read out or typed from a printed slip without mistakes.
   - Always has an upper-case letter, a lower-case letter and a digit.
   The user must replace it on first login, so it only needs to
   survive until then.
   ========================================================== */
const crypto = require('crypto');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

const pick = set => set[crypto.randomInt(set.length)];

function generateTempPassword() {
  // Start with one of each kind, fill up to 12, then shuffle so the kinds are not always first
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < 12) chars.push(pick(ALL));

  for (let i = chars.length - 1; i > 0; i--) {           // Fisher-Yates shuffle
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map(g => g.join('')).join('-');
}

module.exports = { generateTempPassword };