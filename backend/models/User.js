const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username must be at most 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries by default
    },
    /**
     * Access tier. Nivro runs as a closed private beta — accounts are
     * seeded, never self-registered.
     *   owner — full access
     *   beta  — full access, invited testers
     *   demo  — SHARED, publicly-distributed credential. Treat as untrusted:
     *           blocked from expensive operations and read-only where practical.
     */
    role: {
      type: String,
      enum: ['owner', 'beta', 'demo'],
      default: 'beta',
      index: true,
    },
    /**
     * Soft revocation. Preferred over deletion so a revoked account keeps its
     * data and can be restored. Both Express `protect` and the FastAPI auth
     * guard reject inactive users, so clearing this invalidates any outstanding
     * JWT immediately rather than waiting out its 30-day expiry.
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    if (typeof next === 'function') next();
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (typeof next === 'function') next();
});

// Instance method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
