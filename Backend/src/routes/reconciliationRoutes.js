const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, adminOnly } = require('../middleware/auth');
const {
  uploadAndAnalyze,
  applyReconciliation,
  getReconciliationLogs
} = require('../controllers/reconciliationController');

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các tệp định dạng CSV!'), false);
    }
  }
});

// Admin reconciliation endpoints
router.post('/upload', protect, adminOnly, upload.single('file'), uploadAndAnalyze);
router.post('/apply', protect, adminOnly, applyReconciliation);
router.get('/logs', protect, adminOnly, getReconciliationLogs);

module.exports = router;
