const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { convertShopeeLink, redirectShopeeLink, getProductInfo } = require('../controllers/shopeeController');

// Tra cứu thông tin sản phẩm và hoa hồng từ AddLiveTag (GET & POST)
router.get('/product-info', getProductInfo);
router.post('/product-info', getProductInfo);

// Hỗ trợ cả /api/shopee/convert và /api/shopee/generate-link (POST)
router.post('/convert', optionalAuth, convertShopeeLink);
router.post('/generate-link', optionalAuth, convertShopeeLink);

// Hỗ trợ chuyển hướng 302 trực tiếp ăn Cookie 7 ngày (GET)
router.get('/redirect', optionalAuth, redirectShopeeLink);
router.get('/go', optionalAuth, redirectShopeeLink);

module.exports = router;

