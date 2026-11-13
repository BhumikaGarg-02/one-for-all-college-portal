const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PREFIX_ROLE_MAP = {
  STD: 'student',
  TEA: 'teacher',
  ADM: 'admin'
};

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required.'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^(STD|TEA|ADM)\d{4}$/, 'Invalid user ID format.'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters.']
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (val) {
          return !val || /^\S+@\S+\.\S+$/.test(val);
        },
        message: 'Invalid email format.'
      }
    },
    role: {
      type: String,
      required: [true, 'Role is required.'],
      enum: {
        values: ['student', 'teacher', 'admin'],
        message: '{VALUE} is not a valid role.'
      },
      index: true
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      select: false // always stores a bcrypt hash, never plain text
    },
    isFirstLogin: {
      type: Boolean,
      default: true // true until the user changes the admin-issued password; the API exposes this as mustChangePassword
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date
    },
    passwordChangedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Consistency check: ensure userId prefix matches designated role
userSchema.pre('validate', function () {
  if (this.userId && this.role) {
    const prefix = this.userId.substring(0, 3).toUpperCase();
    const expectedRole = PREFIX_ROLE_MAP[prefix];
    if (expectedRole && expectedRole !== this.role) {
      this.invalidate(
        'role',
        `User ID prefix ${prefix} does not match role '${this.role}'. Expected '${expectedRole}'.`
      );
    }
  }
});

// NOTE: findOneAndUpdate, updateOne, and insertMany skip this hook.
// Passwords must always be set or updated through doc.save() or Model.create().
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);

  // Set passwordChangedAt on password updates, but not when the user document is first created
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
});

// Instance method to compare plain password against stored bcrypt hash
userSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.password) {
    throw new Error(
      'Password field not selected. Query with .select("+password") before calling comparePassword.'
    );
  }
  return bcrypt.compare(plainPassword, this.password);
};

// Remove sensitive fields from JSON serialization
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

userSchema.set('toObject', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
