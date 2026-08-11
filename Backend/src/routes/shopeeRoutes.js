const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createAffiliateLink } = require('../controllers/shopeeController');

router.post('/generate-link', protect, createAffiliateLink);

module.exports = router;
