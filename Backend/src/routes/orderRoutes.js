const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  logClick,
  getUserOrders,
  adminGetOrders,
  adminUpdateOrderStatus
} = require('../controllers/orderController');

router.post('/click-log', protect, logClick);
router.get('/user', protect, getUserOrders);
router.get('/admin', protect, adminOnly, adminGetOrders);
router.put('/admin/:id/status', protect, adminOnly, adminUpdateOrderStatus);

module.exports = router;
