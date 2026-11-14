/* ==========================================================
   seedAdmin.js: creates the first admin account
   Run from the project root:   npm run seed:admin
   Optional dev accounts:       node server/seed/seedAdmin.js --with-samples

   Reads from .env: MONGO_URI, SEED_ADMIN_ID, SEED_ADMIN_NAME,
   SEED_ADMIN_PASSWORD (and SEED_SAMPLE_PASSWORD for --with-samples).
   It never overwrites an existing account and never prints a password.
   ========================================================== */

// Load .env from the project root, no matter which folder the command was run from
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const mongoose = require('mongoose');
const User = require('../models/User');

const PLACEHOLDER = 'replace-with-a-temporary-password';   // the value shipped in .env.example
const withSamples = process.argv.includes('--with-samples');

// Temporary passwords must be real values, not the example text
function checkPassword(value, envName) {
  if (!value || value.length < 8 || value === PLACEHOLDER) {
    throw new Error(`${envName} must be set in .env to a temporary password of at least 8 characters.`);
  }
  return value;
}

// Creates one account unless the ID is already taken. Going through User.create() (not
// insertMany or updateOne) matters: it runs the model's password-hashing hook.
async function createIfMissing({ userId, name, role, password }) {
  if (await User.exists({ userId })) {
    console.log(`${userId} already exists, nothing changed.`);
    return;
  }
  await User.create({ userId, name, role, password, isFirstLogin: true, isActive: true });
  console.log(`Created ${role} ${userId}. They must change this password on first login.`);
}

async function main() {
  // 1) Check everything BEFORE touching the database
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');

  const adminId = (process.env.SEED_ADMIN_ID || 'ADM0001').trim().toUpperCase();
  if (!/^ADM\d{4}$/.test(adminId)) throw new Error('SEED_ADMIN_ID must look like ADM0001.');
  const adminName = (process.env.SEED_ADMIN_NAME || 'System Admin').trim();
  const adminPassword = checkPassword(process.env.SEED_ADMIN_PASSWORD, 'SEED_ADMIN_PASSWORD');

  // Sample student and teacher accounts are for testing the login tabs, never for production
  let samplePassword = null;
  if (withSamples) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('--with-samples is ignored when NODE_ENV is "production".');
    } else {
      samplePassword = checkPassword(process.env.SEED_SAMPLE_PASSWORD, 'SEED_SAMPLE_PASSWORD');
    }
  }

  // 2) Connect, create, and always disconnect afterwards
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await createIfMissing({ userId: adminId, name: adminName, role: 'admin', password: adminPassword });

    if (samplePassword) {
      await createIfMissing({ userId: 'STD0001', name: 'Sample Student', role: 'student', password: samplePassword });
      await createIfMissing({ userId: 'TEA0001', name: 'Sample Teacher', role: 'teacher', password: samplePassword });
    }
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
  