const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  logClick,
  getUserOrders,
  adminGetOrders,
  adminUpdateOrderStatus,
  adminDeleteOrder,
  updateOrderScreenshot
} = require('../controllers/orderController');

router.post('/click-log', protect, logClick);
router.get('/user', protect, getUserOrders);
router.put('/:id/screenshot', protect, updateOrderScreenshot);
router.get('/admin', protect, adminOnly, adminGetOrders);
router.put('/admin/:id/status', protect, adminOnly, adminUpdateOrderStatus);
router.delete('/admin/:id', protect, adminOnly, adminDeleteOrder);

module.exports = router;
