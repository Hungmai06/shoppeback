const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  getNotifications,
  readNotifications,
  adminGetUsers,
  adminUpdateUser,
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminToggleUserStatus,
  refreshToken
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read', protect, readNotifications);

// Admin user management routes
router.get('/admin/users', protect, adminOnly, adminGetUsers);
router.post('/admin/users', protect, adminOnly, adminCreateUser);
router.put('/admin/users/:id', protect, adminOnly, adminUpdateUser);
router.delete('/admin/users/:id', protect, adminOnly, adminDeleteUser);
router.put('/admin/users/:id/reset-password', protect, adminOnly, adminResetPassword);
router.put('/admin/users/:id/toggle-status', protect, adminOnly, adminToggleUserStatus);

module.exports = router;


