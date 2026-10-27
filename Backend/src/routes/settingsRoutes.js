const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getSettings,
  updateSettings,
  adminGetStats,
  testAddLiveTagKey,
  testRiohubKey
} = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/admin', protect, adminOnly, updateSettings);
router.get('/admin/stats', protect, adminOnly, adminGetStats);
router.post('/admin/test-addlivetag-key', protect, adminOnly, testAddLiveTagKey);
router.post('/admin/test-riohub-key', protect, adminOnly, testRiohubKey);

module.exports = router;
