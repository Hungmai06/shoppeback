const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getAffiliateOrders,
  confirmAffiliateOrder,
  importAffiliateOrders,
  getOrderCandidates,
  getOrderAuditLogs
} = require('../controllers/affiliateOrderController');

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for CSV uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'aff-order-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các tệp định dạng CSV!'), false);
    }
  }
});

// Admin Affiliate Order Endpoints
router.get('/', protect, adminOnly, getAffiliateOrders);
router.post('/:orderId/confirm', protect, adminOnly, confirmAffiliateOrder);
router.post('/import', protect, adminOnly, upload.single('file'), importAffiliateOrders);
router.get('/:orderId/candidates', protect, adminOnly, getOrderCandidates);
router.get('/:orderId/audit-logs', protect, adminOnly, getOrderAuditLogs);

module.exports = router;
