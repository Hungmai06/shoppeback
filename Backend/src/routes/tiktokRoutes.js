const express = require('express');
const router = express.Router();
const { optionalAuth, protect, adminOnly } = require('../middleware/auth');
const {
  convertTikTokLink,
  getTikTokProductInfo,
  createTikTokGeneralLinks,
  handleTikTokWebhook,
  syncTikTokOrders,
  adminQueryRiohubOrders,
  adminGetTikTokOrders,
  adminUpdateTikTokOrderStatus,
  adminCreateTikTokOrder,
  adminDeleteTikTokOrder,
  adminClearAllTikTokOrders,
  adminGetTikTokClicks
} = require('../controllers/tiktokController');

// 1. Chuyển đổi link TikTok Shop có gắn sub_id (cho người dùng hoặc khách)
router.post('/convert', optionalAuth, convertTikTokLink);
router.post('/generate-link', optionalAuth, convertTikTokLink);

// 2. Tra cứu thông tin sản phẩm và hoa hồng TikTok Shop
router.get('/product-info', getTikTokProductInfo);

// 3. Tạo batch general deep links (tối đa 50 product_ids)
router.post('/general-links', optionalAuth, createTikTokGeneralLinks);

// 4. Webhook / Postback nhận sự kiện đơn hàng từ RioHub (order.created, order.updated, order.refunded)
// Endpoint mở công khai để RioHub gửi request tới
router.post('/webhook', handleTikTokWebhook);
router.post('/postback', handleTikTokWebhook);

// 5. Đồng bộ / Đối soát đơn hàng từ RioHub về hệ thống (Quản trị viên)
router.post('/sync-orders', protect, adminOnly, syncTikTokOrders);
router.get('/admin/riohub-orders', protect, adminOnly, adminQueryRiohubOrders);

// 6. Quản trị đơn hàng TikTok Shop (Quản trị viên)
router.get('/admin/orders', protect, adminOnly, adminGetTikTokOrders);
router.post('/admin/orders', protect, adminOnly, adminCreateTikTokOrder);
router.put('/admin/orders/:id/status', protect, adminOnly, adminUpdateTikTokOrderStatus);
router.delete('/admin/orders/clear-all', protect, adminOnly, adminClearAllTikTokOrders);
router.delete('/admin/orders/:id', protect, adminOnly, adminDeleteTikTokOrder);

// 7. Quản trị lượt click TikTok (click_logs)
router.get('/admin/clicks', protect, adminOnly, adminGetTikTokClicks);

module.exports = router;
