const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getSettings,
  updateSettings,
  adminGetStats
} = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/admin', protect, adminOnly, updateSettings);
router.get('/admin/stats', protect, adminOnly, adminGetStats);

module.exports = router;
