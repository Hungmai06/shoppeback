const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  requestWithdrawal,
  getUserWithdrawals,
  adminGetWithdrawals,
  adminUpdateWithdrawalStatus
} = require('../controllers/withdrawalController');

router.post('/request', protect, requestWithdrawal);
router.get('/user', protect, getUserWithdrawals);
router.get('/admin', protect, adminOnly, adminGetWithdrawals);
router.put('/admin/:id/status', protect, adminOnly, adminUpdateWithdrawalStatus);

module.exports = router;
