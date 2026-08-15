const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { convertShopeeLink } = require('../controllers/shopeeController');

// Hỗ trợ cả /api/shopee/convert và /api/shopee/generate-link
router.post('/convert', optionalAuth, convertShopeeLink);
router.post('/generate-link', optionalAuth, convertShopeeLink);

module.exports = router;
