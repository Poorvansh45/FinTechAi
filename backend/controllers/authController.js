const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────
// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────
const register = asyncHandler(async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Basic field validation
    if (!username || !email || !password) {
      throw new HttpError(400, 'Please provide username, email, and password');
    }

    if (password.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters');
    }

    // Check for existing user
    const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailExists) {
      throw new HttpError(409, 'An account with this email already exists');
    }

    const usernameExists = await User.findOne({ username: username.trim() });
    if (usernameExists) {
      throw new HttpError(409, 'This username is already taken');
    }

    // Create user (password hashed via pre-save hook in model)
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    // Issue JWT cookie
    generateToken(res, user._id);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(error.status || 500).json({ error: error.message });
    }
  }
});

// ─────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────
const login = asyncHandler(async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new HttpError(400, 'Please provide email and password');
    }

    // Fetch user with password (select: false by default)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    // Issue JWT cookie
    generateToken(res, user._id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(error.status || 500).json({ error: error.message });
    }
  }
});

// ─────────────────────────────────────────────
// @desc    Logout user (clear cookie)
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────
const logout = asyncHandler(async (req, res, next) => {
  try {
    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0), // Expire immediately
      sameSite: 'lax',
    });

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ─────────────────────────────────────────────
// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────
const getMe = asyncHandler(async (req, res, next) => {
  try {
    // req.user is already the full user from authMiddleware
    const user = req.user;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ─────────────────────────────────────────────
// @desc    Update username
// @route   PUT /api/auth/username
// @access  Private
// ─────────────────────────────────────────────
const updateUsername = asyncHandler(async (req, res, next) => {
  try {
    const { username } = req.body;

    if (!username || username.trim().length < 3) {
      throw new HttpError(400, 'Username must be at least 3 characters');
    }

    const usernameExists = await User.findOne({
      username: username.trim(),
      _id: { $ne: req.user._id },
    });

    if (usernameExists) {
      throw new HttpError(409, 'This username is already taken');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username: username.trim() },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(error.status || 500).json({ error: error.message });
    }
  }
});

module.exports = { register, login, logout, getMe, updateUsername };
