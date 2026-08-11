const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

// Các API này cần đăng nhập
router.use(protect);

router.get('/stats', referralController.getReferralStats);
router.get('/history', referralController.getReferralHistory);

module.exports = router;
