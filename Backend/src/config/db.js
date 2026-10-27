const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

class MySQLWrapper {
  constructor(pool) {
    this.pool = pool;
  }

  async get(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async all(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  async run(sql, params = []) {
    let normalizedSql = sql;
    // Map SQLite transaction statements to MySQL equivalents if needed
    if (sql.trim().toUpperCase() === 'BEGIN TRANSACTION') {
      normalizedSql = 'START TRANSACTION';
    }
    const [result] = await this.pool.query(normalizedSql, params);
    return {
      lastID: result ? result.insertId : null,
      changes: result ? result.affectedRows : null
    };
  }

  async exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await this.pool.query(stmt);
    }
  }
}

let dbInstance = null;

async function initializeDatabase() {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'mysql') {
    console.log('Connecting to MySQL Database...');
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'affiliateshoppe';

    // 1. Create database if not exists
    const tempConn = await mysql.createConnection({ host, port, user, password });
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConn.end();

    // 2. Create connection pool optimized for high concurrency
    const pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 100,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    const wrapper = new MySQLWrapper(pool);

    // 3. Initialize tables
    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        avatar TEXT,
        bank_name VARCHAR(255),
        account_number VARCHAR(255),
        account_holder VARCHAR(255),
        telegram_chat_id VARCHAR(255),
        email_notify TINYINT DEFAULT 1,
        telegram_notify TINYINT DEFAULT 0,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        balance REAL DEFAULT 0,
        total_cashback REAL DEFAULT 0,
        pending_cashback REAL DEFAULT 0,
        referred_by VARCHAR(255),
        referral_earnings REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      await wrapper.exec('ALTER TABLE users ADD COLUMN referred_by VARCHAR(255)');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE users ADD COLUMN referral_earnings REAL DEFAULT 0');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE users ADD COLUMN referral_clicks INT DEFAULT 0');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE users ADD COLUMN refresh_token TEXT');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE users ADD COLUMN affiliate_sub_id VARCHAR(255)');
    } catch (e) { }

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS click_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NULL,
        product_url TEXT NOT NULL,
        sub_id VARCHAR(255) NULL,
        click_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    try {
      await wrapper.exec('ALTER TABLE click_logs ADD COLUMN sub_id VARCHAR(255)');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE click_logs ADD COLUMN shop_id VARCHAR(100)');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE click_logs ADD COLUMN item_id VARCHAR(100)');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE click_logs MODIFY COLUMN user_id VARCHAR(255) NULL');
    } catch (e) { }

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NULL,
        click_id VARCHAR(255) NULL,
        product_name VARCHAR(255) NOT NULL,
        product_image TEXT,
        order_amount REAL NOT NULL,
        estimated_cashback REAL NOT NULL,
        real_cashback REAL,
        shopee_commission REAL,
        status VARCHAR(50) DEFAULT 'pending',
        screenshot TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      await wrapper.exec('ALTER TABLE orders ADD COLUMN click_id VARCHAR(255)');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE orders ADD COLUMN shopee_commission REAL');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE orders ADD COLUMN shop_id VARCHAR(100)');
    } catch (e) { }
    try {
      await wrapper.exec('ALTER TABLE orders ADD COLUMN item_id VARCHAR(100)');
    } catch (e) { }

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS tiktok_orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NULL,
        click_id VARCHAR(255) NULL,
        product_name VARCHAR(255) NOT NULL,
        product_image TEXT,
        order_amount REAL NOT NULL,
        estimated_cashback REAL NOT NULL,
        real_cashback REAL,
        tiktok_commission REAL,
        status VARCHAR(50) DEFAULT 'pending',
        sub_id VARCHAR(255),
        screenshot TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    try {
      const existingTikTokOrders = await wrapper.all("SELECT * FROM orders WHERE notes LIKE '%TikTok%' OR id LIKE 'TT%' OR click_id LIKE 'TT%'");
      for (const o of existingTikTokOrders) {
        await wrapper.run(
          `INSERT IGNORE INTO tiktok_orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, tiktok_commission, status, screenshot, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.id, o.user_id, o.click_id, o.product_name, o.product_image, o.order_amount, o.estimated_cashback, o.real_cashback, o.shopee_commission || 0, o.status, o.screenshot, o.notes, o.created_at, o.updated_at]
        );
        await wrapper.run("DELETE FROM orders WHERE id = ?", [o.id]);
      }
    } catch (mErr) { }

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        amount REAL NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(255) NOT NULL,
        account_holder VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_date DATETIME,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY,
        website_name VARCHAR(255) DEFAULT 'Hoàn Tiền Mua Sắm',
        support_phone VARCHAR(255) DEFAULT '0988.888.888',
        support_zalo VARCHAR(255) DEFAULT 'https://zalo.me/g/hoantienmuasam',
        support_facebook VARCHAR(255) DEFAULT 'https://facebook.com/hoantienmuasam',
        shopee_affiliate_id VARCHAR(255) DEFAULT '173401900099',
        shopee_cookie_url VARCHAR(500) DEFAULT 'https://s.shopee.vn/an_redir',
        addlivetag_api_key VARCHAR(255) DEFAULT '',
        lazada_affiliate_id VARCHAR(255) DEFAULT '',
        lazada_cookie_url VARCHAR(500) DEFAULT 'https://s.lazada.vn/s.an_redir',
        tiktok_affiliate_id VARCHAR(255) DEFAULT '',
        tiktok_cookie_url VARCHAR(500) DEFAULT 'https://vt.tiktok.com/an_redir',
        tiki_affiliate_id VARCHAR(255) DEFAULT '',
        tiki_cookie_url VARCHAR(500) DEFAULT 'https://tiki.vn/an_redir',
        commission_percentage REAL DEFAULT 10.0,
        cashback_percentage REAL DEFAULT 50.0,
        telegram_notification TINYINT DEFAULT 1,
        email_notification TINYINT DEFAULT 1,
        maintenance_mode TINYINT DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const mysqlAlterCols = [
      "ALTER TABLE system_settings ADD COLUMN shopee_cookie_url VARCHAR(500) DEFAULT 'https://s.shopee.vn/an_redir'",
      "ALTER TABLE system_settings ADD COLUMN addlivetag_api_key VARCHAR(255) DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN lazada_affiliate_id VARCHAR(255) DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN lazada_cookie_url VARCHAR(500) DEFAULT 'https://s.lazada.vn/s.an_redir'",
      "ALTER TABLE system_settings ADD COLUMN tiktok_affiliate_id VARCHAR(255) DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN tiktok_cookie_url VARCHAR(500) DEFAULT 'https://vt.tiktok.com/an_redir'",
      "ALTER TABLE system_settings ADD COLUMN tiki_affiliate_id VARCHAR(255) DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN tiki_cookie_url VARCHAR(500) DEFAULT 'https://tiki.vn/an_redir'",
      "ALTER TABLE system_settings ADD COLUMN riohub_api_key VARCHAR(255) DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN riohub_creator_username VARCHAR(255) DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN riohub_webhook_secret VARCHAR(255) DEFAULT ''"
    ];

    for (const alterQuery of mysqlAlterCols) {
      try { await wrapper.exec(alterQuery); } catch (e) {}
    }

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS reconciliation_logs (
        id VARCHAR(255) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_rows INT NOT NULL,
        matched_count INT DEFAULT 0,
        duplicate_count INT DEFAULT 0,
        invalid_count INT DEFAULT 0,
        missing_count INT DEFAULT 0
      )
    `);

    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        \`read\` TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Seed default settings for MySQL
    const [settingsCountRows] = await pool.query('SELECT COUNT(*) as count FROM system_settings');
    if (settingsCountRows[0].count === 0) {
      await pool.query(`
        INSERT INTO system_settings (id, website_name, support_phone, support_zalo, support_facebook, shopee_affiliate_id, commission_percentage, cashback_percentage)
        VALUES (1, 'Hoàn Tiền Mua Sắm', '0988.888.888', 'https://zalo.me/g/hoantienmuasam', 'https://facebook.com/hoantienmuasam', '173401900099', 10.0, 50.0)
      `);
      console.log('Seeded default system settings for MySQL.');
    }
    await pool.query("UPDATE system_settings SET website_name = 'Hoàn Tiền Mua Sắm' WHERE id = 1");

    // Seed default users for MySQL
    const [usersCountRows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (usersCountRows[0].count === 0) {
      const salt = await bcrypt.genSalt(10);
      const defaultPasswordHash = await bcrypt.hash('password123', salt);

      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, phone, avatar, role, status)
        VALUES (
          'ADM001', 'Admin Hoàn Tiền', 'admin@example.com', ?, '0988888888',
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200', 'admin', 'active'
        )
      `, [defaultPasswordHash]);

      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, phone, avatar, bank_name, account_number, account_holder, role, status)
        VALUES (
          'USR101', 'Nguyễn Văn A', 'user@example.com', ?, '0912345678',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          'Vietcombank', '1029384756', 'NGUYEN VAN A', 'user', 'active'
        )
      `, [defaultPasswordHash]);
      console.log('Seeded default admin (admin@example.com) and user (user@example.com) with password: password123 for MySQL.');
    }

    // Seed tài khoản admin thực tế (chỉ insert nếu email chưa tồn tại)
    const [existingAdmin] = await pool.query('SELECT id FROM users WHERE email = ?', ['khoahodrive0604@gmail.com']);
    if (existingAdmin.length === 0) {
      const realAdminHash = await bcrypt.hash('Hungdz123@', await bcrypt.genSalt(10));
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, phone, avatar, role, status)
        VALUES ('ADM002', 'Khoa Ho', 'khoahodrive0604@gmail.com', ?, '', '', 'admin', 'active')
      `, [realAdminHash]);
      console.log('Seeded real admin: khoahodrive0604@gmail.com');
    }

    // Truncate decimal places in existing orders and users
    try {
      await wrapper.run('UPDATE orders SET shopee_commission = FLOOR(shopee_commission) WHERE shopee_commission IS NOT NULL');
      await wrapper.run('UPDATE orders SET real_cashback = FLOOR(real_cashback) WHERE real_cashback IS NOT NULL');
      await wrapper.run('UPDATE orders SET estimated_cashback = FLOOR(estimated_cashback) WHERE estimated_cashback IS NOT NULL');
      await wrapper.run('UPDATE orders SET order_amount = FLOOR(order_amount) WHERE order_amount IS NOT NULL');
      await wrapper.run('UPDATE users SET balance = FLOOR(balance) WHERE balance IS NOT NULL');
      await wrapper.run('UPDATE users SET total_cashback = FLOOR(total_cashback) WHERE total_cashback IS NOT NULL');
      await wrapper.run('UPDATE users SET referral_earnings = FLOOR(referral_earnings) WHERE referral_earnings IS NOT NULL');
    } catch (e) {}

    console.log(`MySQL connected at: ${host}:${port}, database: ${dbName}`);
    return wrapper;
  } else {
    // SQLite configuration
    const dbPath = path.resolve(__dirname, '../../', process.env.DB_FILE || 'database.sqlite');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log(`SQLite database connected at: ${dbPath}`);

    // High Concurrency SQLite PRAGMAs (WAL mode, cache, busy timeout)
    await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 10000;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = -64000;
      PRAGMA temp_store = MEMORY;
    `);

    // Create tables in SQLite
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        avatar TEXT,
        bank_name TEXT,
        account_number TEXT,
        account_holder TEXT,
        telegram_chat_id TEXT,
        email_notify INTEGER DEFAULT 1,
        telegram_notify INTEGER DEFAULT 0,
        role TEXT CHECK(role IN ('user', 'admin')) DEFAULT 'user',
        status TEXT CHECK(status IN ('active', 'locked')) DEFAULT 'active',
        balance REAL DEFAULT 0,
        total_cashback REAL DEFAULT 0,
        pending_cashback REAL DEFAULT 0,
        referred_by TEXT,
        referral_earnings REAL DEFAULT 0,
        refresh_token TEXT,
        affiliate_sub_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await db.exec('ALTER TABLE users ADD COLUMN referred_by TEXT');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE users ADD COLUMN referral_earnings REAL DEFAULT 0');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE users ADD COLUMN referral_clicks INTEGER DEFAULT 0');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE users ADD COLUMN refresh_token TEXT');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE users ADD COLUMN affiliate_sub_id TEXT');
    } catch (e) { }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS click_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NULL,
        product_url TEXT NOT NULL,
        sub_id TEXT NULL,
        click_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    try {
      await db.exec('ALTER TABLE click_logs ADD COLUMN sub_id TEXT');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE click_logs ADD COLUMN shop_id TEXT');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE click_logs ADD COLUMN item_id TEXT');
    } catch (e) { }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        click_id TEXT,
        product_name TEXT NOT NULL,
        product_image TEXT,
        order_amount REAL NOT NULL,
        estimated_cashback REAL NOT NULL,
        real_cashback REAL,
        shopee_commission REAL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'paid', 'returned')) DEFAULT 'pending',
        screenshot TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await db.exec('ALTER TABLE orders ADD COLUMN click_id TEXT');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE orders ADD COLUMN shopee_commission REAL');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE orders ADD COLUMN shop_id TEXT');
    } catch (e) { }
    try {
      await db.exec('ALTER TABLE orders ADD COLUMN item_id TEXT');
    } catch (e) { }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS tiktok_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        click_id TEXT,
        product_name TEXT NOT NULL,
        product_image TEXT,
        order_amount REAL NOT NULL,
        estimated_cashback REAL NOT NULL,
        real_cashback REAL,
        tiktok_commission REAL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'paid', 'returned')) DEFAULT 'pending',
        sub_id TEXT,
        screenshot TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    try {
      const existingTikTokOrders = await db.all("SELECT * FROM orders WHERE notes LIKE '%TikTok%' OR id LIKE 'TT%' OR click_id LIKE 'TT%'");
      for (const o of existingTikTokOrders) {
        await db.run(
          `INSERT OR IGNORE INTO tiktok_orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, tiktok_commission, status, screenshot, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.id, o.user_id, o.click_id, o.product_name, o.product_image, o.order_amount, o.estimated_cashback, o.real_cashback, o.shopee_commission || 0, o.status, o.screenshot, o.notes, o.created_at, o.updated_at]
        );
        await db.run("DELETE FROM orders WHERE id = ?", [o.id]);
      }
    } catch (mErr) { }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_holder TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_date DATETIME,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        website_name TEXT DEFAULT 'Hoàn Tiền Mua Sắm',
        support_phone TEXT DEFAULT '0988.888.888',
        support_zalo TEXT DEFAULT 'https://zalo.me/g/hoantienmuasam',
        support_facebook TEXT DEFAULT 'https://facebook.com/hoantienmuasam',
        shopee_affiliate_id TEXT DEFAULT '173401900099',
        shopee_cookie_url TEXT DEFAULT 'https://s.shopee.vn/an_redir',
        addlivetag_api_key TEXT DEFAULT '',
        lazada_affiliate_id TEXT DEFAULT '',
        lazada_cookie_url TEXT DEFAULT 'https://s.lazada.vn/s.an_redir',
        tiktok_affiliate_id TEXT DEFAULT '',
        tiktok_cookie_url TEXT DEFAULT 'https://vt.tiktok.com/an_redir',
        tiki_affiliate_id TEXT DEFAULT '',
        tiki_cookie_url TEXT DEFAULT 'https://tiki.vn/an_redir',
        commission_percentage REAL DEFAULT 10.0,
        cashback_percentage REAL DEFAULT 50.0,
        telegram_notification INTEGER DEFAULT 1,
        email_notification INTEGER DEFAULT 1,
        maintenance_mode INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const sqliteAlterCols = [
      "ALTER TABLE system_settings ADD COLUMN shopee_cookie_url TEXT DEFAULT 'https://s.shopee.vn/an_redir'",
      "ALTER TABLE system_settings ADD COLUMN addlivetag_api_key TEXT DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN lazada_affiliate_id TEXT DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN lazada_cookie_url TEXT DEFAULT 'https://s.lazada.vn/s.an_redir'",
      "ALTER TABLE system_settings ADD COLUMN tiktok_affiliate_id TEXT DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN tiktok_cookie_url TEXT DEFAULT 'https://vt.tiktok.com/an_redir'",
      "ALTER TABLE system_settings ADD COLUMN tiki_affiliate_id TEXT DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN tiki_cookie_url TEXT DEFAULT 'https://tiki.vn/an_redir'",
      "ALTER TABLE system_settings ADD COLUMN riohub_api_key TEXT DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN riohub_creator_username TEXT DEFAULT ''",
      "ALTER TABLE system_settings ADD COLUMN riohub_webhook_secret TEXT DEFAULT ''"
    ];

    for (const alterQuery of sqliteAlterCols) {
      try { await db.exec(alterQuery); } catch (e) {}
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS reconciliation_logs (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_rows INTEGER NOT NULL,
        matched_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        invalid_count INTEGER DEFAULT 0,
        missing_count INTEGER DEFAULT 0
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT CHECK(type IN ('order', 'wallet', 'system')) NOT NULL,
        \`read\` INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Seed default settings for SQLite
    const settingsCount = await db.get('SELECT COUNT(*) as count FROM system_settings');
    if (settingsCount.count === 0) {
      await db.run(`
        INSERT INTO system_settings (id, website_name, support_phone, support_zalo, support_facebook, shopee_affiliate_id, commission_percentage, cashback_percentage)
        VALUES (1, 'Hoàn Tiền Mua Sắm', '0988.888.888', 'https://zalo.me/g/hoantienmuasam', 'https://facebook.com/hoantienmuasam', '173401900099', 10.0, 50.0)
      `);
      console.log('Seeded default system settings for SQLite.');
    }
    await db.run("UPDATE system_settings SET website_name = 'Hoàn Tiền Mua Sắm' WHERE id = 1");

    // Seed default admin and user for SQLite
    const usersCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (usersCount.count === 0) {
      const salt = await bcrypt.genSalt(10);
      const defaultPasswordHash = await bcrypt.hash('password123', salt);

      await db.run(`
        INSERT INTO users (id, name, email, password_hash, phone, avatar, role, status)
        VALUES (
          'ADM001', 'Admin Hoàn Tiền', 'admin@example.com', ?, '0988888888',
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200', 'admin', 'active'
        )
      `, [defaultPasswordHash]);

      await db.run(`
        INSERT INTO users (id, name, email, password_hash, phone, avatar, bank_name, account_number, account_holder, role, status)
        VALUES (
          'USR101', 'Nguyễn Văn A', 'user@example.com', ?, '0912345678',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          'Vietcombank', '1029384756', 'NGUYEN VAN A', 'user', 'active'
        )
      `, [defaultPasswordHash]);
      console.log('Seeded default admin (admin@example.com) and user (user@example.com) with password: password123 for SQLite.');
    }

    // Seed tài khoản admin thực tế (chỉ insert nếu email chưa tồn tại)
    const existingRealAdmin = await db.get('SELECT id FROM users WHERE email = ?', ['khoahodrive0604@gmail.com']);
    if (!existingRealAdmin) {
      const realAdminHash = await bcrypt.hash('Hungdz123@', await bcrypt.genSalt(10));
      await db.run(`
        INSERT INTO users (id, name, email, password_hash, phone, avatar, role, status)
        VALUES ('ADM002', 'Khoa Ho', 'khoahodrive0604@gmail.com', ?, '', '', 'admin', 'active')
      `, [realAdminHash]);
      console.log('Seeded real admin: khoahodrive0604@gmail.com');
    }

    // Truncate decimal places in existing orders and users
    try {
      await db.run('UPDATE orders SET shopee_commission = CAST(shopee_commission AS INT) WHERE shopee_commission IS NOT NULL');
      await db.run('UPDATE orders SET real_cashback = CAST(real_cashback AS INT) WHERE real_cashback IS NOT NULL');
      await db.run('UPDATE orders SET estimated_cashback = CAST(estimated_cashback AS INT) WHERE estimated_cashback IS NOT NULL');
      await db.run('UPDATE orders SET order_amount = CAST(order_amount AS INT) WHERE order_amount IS NOT NULL');
      await db.run('UPDATE users SET balance = CAST(balance AS INT) WHERE balance IS NOT NULL');
      await db.run('UPDATE users SET total_cashback = CAST(total_cashback AS INT) WHERE total_cashback IS NOT NULL');
      await db.run('UPDATE users SET referral_earnings = CAST(referral_earnings AS INT) WHERE referral_earnings IS NOT NULL');
    } catch (e) {}

    return db;
  }
}

async function getDatabase() {
  if (!dbInstance) {
    let retries = 60;
    while (retries > 0) {
      try {
        dbInstance = await initializeDatabase();
        console.log('✅ Database successfully initialized and connected!');
        break;
      } catch (err) {
        retries--;
        console.error(`⚠️ Database connection error: ${err.message}. Retrying in 3 seconds... (${retries} retries remaining)`);
        if (retries === 0) throw err;
        await new Promise(res => setTimeout(res, 3000));
      }
    }
  }
  return dbInstance;
}

module.exports = { getDatabase };
