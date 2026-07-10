const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, updateUsername, getToken } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/username', protect, updateUsername);
router.get('/token', protect, getToken);

module.exports = router;
