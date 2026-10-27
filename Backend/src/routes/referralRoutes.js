const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

// Public route: Ghi nhận click link giới thiệu
router.post('/click', referralController.recordReferralClick);

// Các API bên dưới cần đăng nhập
router.use(protect);

router.get('/stats', referralController.getReferralStats);
router.get('/history', referralController.getReferralHistory);
router.get('/members', referralController.getReferralMembers);

module.exports = router;
