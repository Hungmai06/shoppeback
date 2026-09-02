const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { convertShopeeLink, redirectShopeeLink } = require('../controllers/shopeeController');

// Hỗ trợ cả /api/shopee/convert và /api/shopee/generate-link (POST)
router.post('/convert', optionalAuth, convertShopeeLink);
router.post('/generate-link', optionalAuth, convertShopeeLink);

// Hỗ trợ chuyển hướng 302 trực tiếp ăn Cookie 7 ngày (GET)
router.get('/redirect', optionalAuth, redirectShopeeLink);
router.get('/go', optionalAuth, redirectShopeeLink);

module.exports = router;

