-- =========================================================================
-- SHOPEE AFFILIATE AUTOMATIC ATTRIBUTION & MATCHING SYSTEM MIGRATION
-- Compatible with MySQL 5.7+ / 8.0+ and SQLite 3
-- =========================================================================

-- 1. Create table `affiliate_clicks`
-- Stores website user click logs, sub_id, item_id, shop_id, origin_url, and click timestamp
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NULL,
  click_id VARCHAR(255) UNIQUE NOT NULL,
  sub_id VARCHAR(255) NULL,
  item_id VARCHAR(255) NULL,
  shop_id VARCHAR(255) NULL,
  origin_url TEXT NULL,
  clicked_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aff_clicks_click_id (click_id),
  INDEX idx_aff_clicks_sub_id (sub_id),
  INDEX idx_aff_clicks_user_id (user_id),
  INDEX idx_aff_clicks_item_shop (item_id, shop_id),
  INDEX idx_aff_clicks_clicked_at (clicked_at)
);

-- 2. Create table `affiliate_orders`
-- Stores Shopee affiliate orders, raw sub_ids, matching result, attribution status, and scores
CREATE TABLE IF NOT EXISTS affiliate_orders (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  checkout_id VARCHAR(255) NULL,
  user_id VARCHAR(255) NULL,
  item_id VARCHAR(255) NULL,
  shop_id VARCHAR(255) NULL,
  order_time DATETIME NULL,
  shopee_click_time DATETIME NULL,
  commission REAL DEFAULT 0,
  shopee_status VARCHAR(255) NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  matched_by VARCHAR(50) NULL,
  match_score REAL NULL,
  matched_click_id VARCHAR(255) NULL,
  sub_id1 VARCHAR(255) NULL,
  sub_id2 VARCHAR(255) NULL,
  sub_id3 VARCHAR(255) NULL,
  sub_id4 VARCHAR(255) NULL,
  sub_id5 VARCHAR(255) NULL,
  product_name TEXT NULL,
  order_amount REAL DEFAULT 0,
  raw_data TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_aff_orders_order_id (order_id),
  INDEX idx_aff_orders_user_id (user_id),
  INDEX idx_aff_orders_status (status),
  INDEX idx_aff_orders_item_shop (item_id, shop_id),
  INDEX idx_aff_orders_order_time (order_time)
);

-- 3. Create table `order_match_audit_logs`
-- Stores admin manual attribution confirmations and adjustments for accountability
CREATE TABLE IF NOT EXISTS order_match_audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  admin_id VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  previous_user_id VARCHAR(255) NULL,
  new_user_id VARCHAR(255) NULL,
  previous_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_order_id (order_id),
  INDEX idx_audit_admin_id (admin_id),
  INDEX idx_audit_created_at (created_at)
);
