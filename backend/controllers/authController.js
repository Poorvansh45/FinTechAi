const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { jwtCookieOptions } = require('../utils/generateToken');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

// NOTE: there is no `register` handler. FinTechAI runs as a closed private
// beta — accounts are seeded via `scripts/seedUsers.js` and self-registration
// is not supported. See docs/PRIVATE-BETA.md.

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

    // Revoked accounts are rejected AFTER the password check on purpose: a
    // different message for a wrong password vs a deactivated account would let
    // an outsider enumerate which addresses exist on the beta.
    if (user.isActive === false) {
      throw new HttpError(403, 'This account is not active. FinTechAI is currently invite-only.');
    }

    // Issue JWT cookie
    generateToken(res, user._id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
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
    // Same attributes as when it was issued. A clearing Set-Cookie whose
    // sameSite/secure differ is rejected cross-site, which would leave the
    // session alive after a "successful" logout.
    res.cookie('jwt', '', {
      ...jwtCookieOptions,
      expires: new Date(0), // Expire immediately
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
        role: user.role,
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
        role: user.role,
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
// @desc    Return the raw JWT for the current session, so the frontend can
//          attach it as "Authorization: Bearer <token>" when calling other
//          services (FastAPI, Next.js API routes) that cannot see Express's
//          host-only httpOnly cookie. Does not create or change the token —
//          it is the same JWT already issued at login.
// @route   GET /api/auth/token
// @access  Private
// ─────────────────────────────────────────────
const getToken = asyncHandler(async (req, res, next) => {
  try {
    res.status(200).json({ success: true, token: req.token });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = { login, logout, getMe, updateUsername, getToken };
