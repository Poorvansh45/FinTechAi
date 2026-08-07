const express = require('express');
const router = express.Router();
const { login, logout, getMe, updateUsername, getToken } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
//
// There is deliberately NO /register route. FinTechAI is a closed private beta:
// accounts are seeded by `scripts/seedUsers.js` and nobody can self-register.
// The route is removed rather than merely guarded so it cannot regress behind a
// misconfigured flag.
router.post('/login', login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/username', protect, updateUsername);
router.get('/token', protect, getToken);

module.exports = router;
