const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cluster = require('cluster');
const os = require('os');
const { getDatabase } = require('./src/config/db');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const isClusterEnabled = process.env.CLUSTER_MODE === 'true';

// Multi-core CPU Cluster scaling
if (isClusterEnabled && cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`🚀 Primary process ${process.pid} is running. Forking ${numCPUs} worker processes...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️ Worker process ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting new worker...`);
    cluster.fork();
  });
} else {
  const app = express();
  app.set('trust proxy', 1); // Trust first proxy (Nginx)

  // 1. Enable GZIP Response Compression for high bandwidth efficiency
  app.use(compression({
    level: 6,
    threshold: 512 // Compress any response > 512 bytes
  }));

  // 2. Enable CORS
  app.use(cors({
    origin: '*', // Can restrict to specific domain in production
    credentials: true
  }));

  // 3. Body parsing limits (protects memory against large payload attacks)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Rate Limiting Protection against DDoS / Spam traffic spikes
  const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 2000, // Max 2000 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Hệ thống đang xử lý nhiều lượt truy cập. Vui lòng thử lại sau ít phút.' }
  });

  const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200, // Max 200 login/register attempts per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Thao tác quá nhanh. Vui lòng đợi ít phút trước khi thử lại.' }
  });

  app.use('/api/', globalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // 5. In-Memory Cache middleware for public settings endpoint
  let settingsCache = null;
  let settingsCacheTime = 0;
  const CACHE_TTL_MS = 10000; // 10 seconds cache

  app.use('/api/settings', (req, res, next) => {
    if (req.method === 'GET') {
      const now = Date.now();
      if (settingsCache && (now - settingsCacheTime < CACHE_TTL_MS)) {
        return res.json(settingsCache);
      }
      // Intercept res.json to cache response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode === 200) {
          settingsCache = body;
          settingsCacheTime = Date.now();
        }
        return originalJson(body);
      };
    }
    next();
  });

  // Serve static uploads with aggressive browser caching
  app.use('/uploads', express.static('uploads', { maxAge: '7d' }));

  // 6. Bind API Routes
  app.use('/api/auth', require('./src/routes/authRoutes'));
  app.use('/api/orders', require('./src/routes/orderRoutes'));
  app.use('/api/reconciliation', require('./src/routes/reconciliationRoutes'));
  app.use('/api/withdrawals', require('./src/routes/withdrawalRoutes'));
  app.use('/api/settings', require('./src/routes/settingsRoutes'));
  app.use('/api/referrals', require('./src/routes/referralRoutes'));
  app.use('/api/shopee', require('./src/routes/shopeeRoutes'));

  // Root endpoint status check
  app.get('/', (req, res) => {
    res.json({ status: 'online', mode: process.env.NODE_ENV || 'production', timestamp: new Date() });
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
      message: err.message || 'Hệ thống đang bận. Vui lòng thử lại sau.'
    });
  });

  // Catch unexpected process errors without crashing node
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED PROMISE REJECTION:', reason);
  });

  // Start Server
  async function startServer() {
    try {
      await getDatabase();
      app.listen(PORT, () => {
        console.log(`✅ Worker ${process.pid} running high-concurrency API server on port ${PORT}`);
      });
    } catch (error) {
      console.error('❌ Server startup error:', error);
      process.exit(1);
    }
  }

  startServer();
}
