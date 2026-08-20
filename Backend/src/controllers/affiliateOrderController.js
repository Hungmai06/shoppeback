const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getDatabase } = require('../config/db');
const {
  extractShopeeIds,
  parseDateTime,
  calculateTimeScore,
  mapShopeeFulfillmentStatus,
  matchOrder,
  creditUserCashbackIfEligible
} = require('../services/affiliateMatchingService');

// Normalize CSV header for flexible column mapping
function normalizeHeader(header) {
  if (!header) return '';
  return header.toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Detect CSV separator (; or , or \t)
function detectSeparator(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(1000);
    const bytesRead = fs.readSync(fd, buffer, 0, 1000, 0);
    fs.closeSync(fd);
    
    const data = buffer.toString('utf8', 0, bytesRead);
    const firstLine = data.split(/\r?\n/)[0] || '';
    
    if (firstLine.includes(';')) {
      const commas = (firstLine.match(/,/g) || []).length;
      const semicolons = (firstLine.match(/;/g) || []).length;
      if (semicolons > commas) return ';';
    } else if (firstLine.includes('\t')) {
      return '\t';
    }
  } catch (err) {
    console.error('Error detecting separator:', err);
  }
  return ',';
}

// Extract standardized row fields from Shopee CSV row
function extractCsvRowFields(row) {
  const normMap = {};
  for (const [key, val] of Object.entries(row)) {
    normMap[normalizeHeader(key)] = { orig: key, val: (val || '').trim() };
  }

  // 1. ORDER ID
  let orderId = '';
  for (const k of ['iddonhang', 'madonhang', 'ordersn', 'orderid', 'id', 'sn']) {
    if (normMap[k] && normMap[k].val) {
      orderId = normMap[k].val;
      break;
    }
  }
  if (!orderId) {
    for (const [k, v] of Object.entries(normMap)) {
      if ((k.includes('iddon') || k.includes('madon') || k.includes('ordersn')) && v.val) {
        orderId = v.val;
        break;
      }
    }
  }

  // 2. CHECKOUT ID
  let checkoutId = '';
  for (const k of ['checkoutid', 'checkout_id', 'macheckout', 'idcheckout']) {
    if (normMap[k] && normMap[k].val) {
      checkoutId = normMap[k].val;
      break;
    }
  }

  // 3. ITEM ID
  let itemId = '';
  for (const k of ['itemid', 'item_id', 'idsanpham', 'masanpham', 'productid']) {
    if (normMap[k] && normMap[k].val) {
      itemId = normMap[k].val;
      break;
    }
  }

  // 4. SHOP ID
  let shopId = '';
  for (const k of ['shopid', 'shop_id', 'idshop', 'mashop']) {
    if (normMap[k] && normMap[k].val) {
      shopId = normMap[k].val;
      break;
    }
  }

  // 5. PRODUCT NAME
  let productName = '';
  for (const k of ['tenitem', 'tensanpham', 'itemname', 'productname', 'tensp']) {
    if (normMap[k] && normMap[k].val) {
      productName = normMap[k].val;
      break;
    }
  }

  // 6. ORDER AMOUNT
  let orderAmount = 0;
  for (const k of ['giatridonhangd', 'giatridonhang', 'ordervalue', 'tongtien', 'orderamount', 'gia']) {
    if (normMap[k] && normMap[k].val) {
      const parsed = parseFloat(normMap[k].val.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        orderAmount = parsed;
        break;
      }
    }
  }

  // 7. COMMISSION
  let commission = 0;
  for (const k of [
    'hoahongrongtipthilienketd',
    'hoahongrongtipthilienket',
    'tonghoahongdonhangd',
    'tonghoahongdonhang',
    'hoahongdonhangtushopeed',
    'hoahongdonhangtushopee',
    'hoahong',
    'commission'
  ]) {
    if (normMap[k] && normMap[k].val) {
      const parsed = parseFloat(normMap[k].val.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(parsed)) {
        commission = parsed;
        break;
      }
    }
  }

  // 8. SHOPEE STATUS
  let shopeeStatus = '';
  for (const k of ['trangthaidathang', 'trangthaidonhang', 'trangthai', 'status']) {
    if (normMap[k] && normMap[k].val) {
      shopeeStatus = normMap[k].val;
      break;
    }
  }

  // 9. ORDER TIME
  let orderTime = null;
  for (const k of ['thoigiandathang', 'thoigiantao', 'thoigiandat', 'purchasetime', 'ordertime']) {
    if (normMap[k] && normMap[k].val) {
      orderTime = normMap[k].val;
      break;
    }
  }

  // 10. SHOPEE CLICK TIME
  let shopeeClickTime = null;
  for (const k of ['thoigianclick', 'clicktime', 'thoigiannhap', 'shopeeclicktime']) {
    if (normMap[k] && normMap[k].val) {
      shopeeClickTime = normMap[k].val;
      break;
    }
  }

  // 11. SUB_IDs
  let subId1 = normMap['subid1'] ? normMap['subid1'].val : (normMap['sub1'] ? normMap['sub1'].val : '');
  let subId2 = normMap['subid2'] ? normMap['subid2'].val : (normMap['sub2'] ? normMap['sub2'].val : '');
  let subId3 = normMap['subid3'] ? normMap['subid3'].val : (normMap['sub3'] ? normMap['sub3'].val : '');
  let subId4 = normMap['subid4'] ? normMap['subid4'].val : (normMap['sub4'] ? normMap['sub4'].val : '');
  let subId5 = normMap['subid5'] ? normMap['subid5'].val : (normMap['sub5'] ? normMap['sub5'].val : '');

  return {
    orderId,
    checkoutId,
    itemId,
    shopId,
    productName,
    orderAmount,
    commission,
    shopeeStatus,
    orderTime,
    shopeeClickTime,
    subId1,
    subId2,
    subId3,
    subId4,
    subId5
  };
}

/**
 * GET /api/admin/affiliate-orders
 * Lấy danh sách đơn hàng Affiliate kèm bộ lọc, phân trang và thông tin candidate users
 */
async function getAffiliateOrders(req, res) {
  try {
    const {
      status,
      matchedBy,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const db = await getDatabase();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereSql = ' WHERE 1=1';
    const params = [];
    const countParams = [];

    if (status && status !== 'all') {
      whereSql += ' AND o.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (matchedBy && matchedBy !== 'all') {
      whereSql += ' AND o.matched_by = ?';
      params.push(matchedBy);
      countParams.push(matchedBy);
    }

    if (search) {
      const searchParam = `%${search.trim()}%`;
      whereSql += ' AND (o.order_id LIKE ? OR o.user_id LIKE ? OR o.item_id LIKE ? OR o.shop_id LIKE ? OR o.product_name LIKE ?)';
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    const countQuery = `SELECT COUNT(*) as count FROM affiliate_orders o ${whereSql}`;
    const totalResult = await db.get(countQuery, countParams);
    const total = totalResult ? totalResult.count : 0;

    const selectQuery = `
      SELECT 
        o.id,
        o.order_id,
        o.checkout_id,
        o.user_id,
        u.name as user_name,
        u.email as user_email,
        o.item_id,
        o.shop_id,
        o.product_name,
        o.order_amount,
        o.commission,
        o.order_time,
        o.shopee_click_time,
        o.shopee_status,
        o.status,
        o.matched_by,
        o.match_score,
        o.matched_click_id,
        o.sub_id1,
        o.sub_id2,
        o.sub_id3,
        o.sub_id4,
        o.sub_id5,
        o.created_at,
        o.updated_at
      FROM affiliate_orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereSql}
      ORDER BY o.order_time DESC, o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));
    const orders = await db.all(selectQuery, params);

    // Đối với các đơn NEED_REVIEW hoặc UNMATCHED, load danh sách candidates
    const windowMinutes = parseInt(process.env.AFFILIATE_MATCH_WINDOW_MINUTES || '120', 10);
    const enrichedOrders = [];

    for (const order of orders) {
      let candidates = [];
      if (order.status === 'NEED_REVIEW' || order.status === 'UNMATCHED') {
        const orderItem = {
          order_id: order.order_id,
          item_id: order.item_id,
          shop_id: order.shop_id,
          order_time: order.order_time,
          shopee_click_time: order.shopee_click_time,
          sub_id1: order.sub_id1,
          sub_id2: order.sub_id2,
          sub_id3: order.sub_id3,
          sub_id4: order.sub_id4,
          sub_id5: order.sub_id5
        };
        const matchResult = await matchOrder(orderItem, db);
        candidates = matchResult.candidates || [];
      }

      enrichedOrders.push({
        ...order,
        candidates
      });
    }

    return res.json({
      success: true,
      orders: enrichedOrders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get Affiliate Orders Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách đơn hàng affiliate: ' + error.message
    });
  }
}

/**
 * POST /api/admin/affiliate-orders/:orderId/confirm
 * Admin xác nhận thủ công gán đơn hàng cho một user candidate
 */
async function confirmAffiliateOrder(req, res) {
  const { orderId } = req.params;
  const { userId, notes } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp userId để xác nhận đơn hàng'
    });
  }

  try {
    const db = await getDatabase();

    // 1. Kiểm tra user có tồn tại không
    const user = await db.get('SELECT id, name, email FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy người dùng có ID: ${userId}`
      });
    }

    // 2. Tìm đơn hàng trong affiliate_orders
    const order = await db.get('SELECT * FROM affiliate_orders WHERE order_id = ? OR id = ?', [orderId, orderId]);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy đơn hàng affiliate: ${orderId}`
      });
    }

    const previousUserId = order.user_id;
    const previousStatus = order.status;
    const adminId = req.user ? req.user.id : 'ADMIN';

    await db.run('BEGIN TRANSACTION');

    // 3. Cập nhật trạng thái và user_id cho affiliate_orders
    await db.run(
      `UPDATE affiliate_orders
       SET status = 'CONFIRMED_MANUAL',
           matched_by = 'MANUAL',
           match_score = 100,
           user_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [userId, order.order_id]
    );

    // 4. Đồng bộ vào bảng orders
    try {
      const existingInOrders = await db.get('SELECT id FROM orders WHERE id = ?', [order.order_id]);
      const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
      const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;
      const userCashback = Math.round((order.commission || 0) * cashbackRate);
      const mappedOrderStatus = mapShopeeFulfillmentStatus(order.shopee_status);

      if (existingInOrders) {
        await db.run(
          `UPDATE orders
           SET user_id = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [userId, order.order_id]
        );
      } else {
        await db.run(
          `INSERT INTO orders (
             id, user_id, click_id, product_name, product_image,
             order_amount, estimated_cashback, real_cashback, shopee_commission,
             status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            order.order_id,
            userId,
            order.matched_click_id || null,
            order.product_name || 'Sản phẩm Shopee',
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200',
            order.order_amount || 0,
            userCashback,
            userCashback,
            order.commission || 0,
            mappedOrderStatus,
            order.order_time || new Date().toISOString().replace('T', ' ').substring(0, 19)
          ]
        );
      }
    } catch (e) {
      console.warn('Sync orders table on confirm warning:', e.message);
    }

    // 5. Ghi Audit Log người thực hiện và thời gian
    const auditId = `AUD_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    await db.run(
      `INSERT INTO order_match_audit_logs (id, order_id, admin_id, action, previous_user_id, new_user_id, previous_status, new_status, notes)
       VALUES (?, ?, ?, 'CONFIRMED_MANUAL', ?, ?, ?, 'CONFIRMED_MANUAL', ?)`,
      [
        auditId,
        order.order_id,
        adminId,
        previousUserId || null,
        userId,
        previousStatus || null,
        notes || 'Admin xác nhận thủ công gán đơn hàng cho thành viên'
      ]
    );

    // 6. Kiểm tra an toàn tài chính: Nếu đơn hàng đã hoàn thành ở Shopee thì cộng hoa hồng
    const updatedOrder = {
      ...order,
      user_id: userId,
      status: 'CONFIRMED_MANUAL'
    };
    const financeResult = await creditUserCashbackIfEligible(updatedOrder, db, adminId);

    await db.run('COMMIT');

    console.log(`[AFFILIATE ADMIN] 👤 Order #${order.order_id} manually confirmed for User: ${userId} by Admin: ${adminId}`);

    return res.json({
      success: true,
      message: `Đã xác nhận gán đơn hàng #${order.order_id} cho thành viên ${user.name} (${user.email}) thành công!`,
      data: {
        orderId: order.order_id,
        userId,
        status: 'CONFIRMED_MANUAL',
        matchedBy: 'MANUAL',
        cashbackCredited: financeResult.credited,
        cashbackAmount: financeResult.cashback
      }
    });

  } catch (error) {
    const db = await getDatabase();
    await db.run('ROLLBACK');
    console.error('Confirm Affiliate Order Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xác nhận đơn hàng: ' + error.message
    });
  }
}

/**
 * POST /api/admin/affiliate-orders/import
 * Import đơn hàng Shopee từ file CSV hoặc JSON payload và chạy Matching Engine
 */
async function importAffiliateOrders(req, res) {
  try {
    const db = await getDatabase();
    let rawOrderRows = [];

    // Trường hợp 1: Upload file CSV
    if (req.file) {
      const filePath = req.file.path;
      const separator = detectSeparator(filePath);

      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator }))
          .on('data', row => rawOrderRows.push(row))
          .on('end', resolve)
          .on('error', reject);
      });

      // Dọn file tạm
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) { }
    } else if (req.body && req.body.orders && Array.isArray(req.body.orders)) {
      // Trường hợp 2: JSON payload { orders: [...] }
      rawOrderRows = req.body.orders;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên file CSV hoặc truyền mảng danh sách đơn hàng orders'
      });
    }

    if (rawOrderRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy dữ liệu đơn hàng trong tệp/yêu cầu'
      });
    }

    let totalProcessed = 0;
    let matchedBySubId = 0;
    let matchedByItemShopTime = 0;
    let needReviewCount = 0;
    let unmatchedCount = 0;
    const processedOrders = [];

    await db.run('BEGIN TRANSACTION');

    for (const rawRow of rawOrderRows) {
      let fields;
      if (rawRow.orderId || rawRow.order_id) {
        // Đã là object format chuẩn
        fields = {
          orderId: rawRow.orderId || rawRow.order_id,
          checkoutId: rawRow.checkoutId || rawRow.checkout_id || '',
          itemId: rawRow.itemId || rawRow.item_id || '',
          shopId: rawRow.shopId || rawRow.shop_id || '',
          productName: rawRow.productName || rawRow.product_name || 'Sản phẩm Shopee',
          orderAmount: Number(rawRow.orderAmount || rawRow.order_amount) || 0,
          commission: Number(rawRow.commission || rawRow.shopee_commission) || 0,
          shopeeStatus: rawRow.shopeeStatus || rawRow.shopee_status || rawRow.status || 'pending',
          orderTime: rawRow.orderTime || rawRow.order_time || new Date().toISOString().replace('T', ' ').substring(0, 19),
          shopeeClickTime: rawRow.shopeeClickTime || rawRow.shopee_click_time || null,
          subId1: rawRow.subId1 || rawRow.sub_id1 || '',
          subId2: rawRow.subId2 || rawRow.sub_id2 || '',
          subId3: rawRow.subId3 || rawRow.sub_id3 || '',
          subId4: rawRow.subId4 || rawRow.sub_id4 || '',
          subId5: rawRow.subId5 || rawRow.sub_id5 || ''
        };
      } else {
        // Parse từ dòng CSV raw
        fields = extractCsvRowFields(rawRow);
      }

      if (!fields.orderId) {
        continue;
      }

      totalProcessed++;

      // Kiểm tra đơn đã tồn tại trong DB chưa
      const existingOrder = await db.get(
        'SELECT * FROM affiliate_orders WHERE order_id = ?',
        [fields.orderId]
      );

      // Chạy matching engine
      const matchResult = await matchOrder({
        order_id: fields.orderId,
        checkout_id: fields.checkoutId,
        item_id: fields.itemId,
        shop_id: fields.shopId,
        order_time: fields.orderTime,
        shopee_click_time: fields.shopeeClickTime,
        commission: fields.commission,
        shopee_status: fields.shopeeStatus,
        sub_id1: fields.subId1,
        sub_id2: fields.subId2,
        sub_id3: fields.subId3,
        sub_id4: fields.subId4,
        sub_id5: fields.subId5
      }, db);

      let finalUserId = matchResult.userId;
      let finalStatus = matchResult.status;
      let finalMatchedBy = matchResult.matchedBy;
      let finalMatchScore = matchResult.matchScore;

      // QUY TẮC AN TOÀN: Nếu đơn trước đó đã match bằng SUB_ID hoặc CONFIRMED_MANUAL thì không bị ghi đè bởi fallback
      if (existingOrder) {
        if (existingOrder.matched_by === 'SUB_ID' || existingOrder.status === 'CONFIRMED_MANUAL') {
          finalUserId = existingOrder.user_id;
          finalStatus = existingOrder.status;
          finalMatchedBy = existingOrder.matched_by;
          finalMatchScore = existingOrder.match_score;
        }
      }

      if (finalMatchedBy === 'SUB_ID') matchedBySubId++;
      else if (finalMatchedBy === 'ITEM_SHOP_TIME') matchedByItemShopTime++;
      else if (finalStatus === 'NEED_REVIEW') needReviewCount++;
      else unmatchedCount++;

      // Upsert vào affiliate_orders
      if (existingOrder) {
        await db.run(
          `UPDATE affiliate_orders
           SET checkout_id = COALESCE(?, checkout_id),
               user_id = ?,
               item_id = COALESCE(?, item_id),
               shop_id = COALESCE(?, shop_id),
               order_time = COALESCE(?, order_time),
               shopee_click_time = COALESCE(?, shopee_click_time),
               commission = ?,
               shopee_status = ?,
               status = ?,
               matched_by = ?,
               match_score = ?,
               matched_click_id = ?,
               sub_id1 = ?,
               sub_id2 = ?,
               sub_id3 = ?,
               sub_id4 = ?,
               sub_id5 = ?,
               product_name = COALESCE(?, product_name),
               order_amount = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = ?`,
          [
            fields.checkoutId || null,
            finalUserId,
            fields.itemId || null,
            fields.shopId || null,
            fields.orderTime || null,
            fields.shopeeClickTime || null,
            fields.commission,
            fields.shopeeStatus,
            finalStatus,
            finalMatchedBy,
            finalMatchScore,
            matchResult.matchedClickId || null,
            fields.subId1 || null,
            fields.subId2 || null,
            fields.subId3 || null,
            fields.subId4 || null,
            fields.subId5 || null,
            fields.productName || null,
            fields.orderAmount,
            fields.orderId
          ]
        );
      } else {
        const rowId = `AFF_ORD_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
        await db.run(
          `INSERT INTO affiliate_orders (
             id, order_id, checkout_id, user_id, item_id, shop_id,
             order_time, shopee_click_time, commission, shopee_status,
             status, matched_by, match_score, matched_click_id,
             sub_id1, sub_id2, sub_id3, sub_id4, sub_id5,
             product_name, order_amount
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rowId,
            fields.orderId,
            fields.checkoutId || null,
            finalUserId,
            fields.itemId || null,
            fields.shopId || null,
            fields.orderTime || null,
            fields.shopeeClickTime || null,
            fields.commission,
            fields.shopeeStatus,
            finalStatus,
            finalMatchedBy,
            finalMatchScore,
            matchResult.matchedClickId || null,
            fields.subId1 || null,
            fields.subId2 || null,
            fields.subId3 || null,
            fields.subId4 || null,
            fields.subId5 || null,
            fields.productName || 'Sản phẩm Shopee',
            fields.orderAmount
          ]
        );
      }

      // Đồng bộ trực tiếp vào bảng `orders` để Admin Dashboard và User Dashboard hiển thị ngay lập tức
      try {
        const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
        const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;
        const userCashback = Math.round((fields.commission || 0) * cashbackRate);
        const mappedOrderStatus = mapShopeeFulfillmentStatus(fields.shopeeStatus);

        const existingLegacy = await db.get('SELECT id FROM orders WHERE id = ?', [fields.orderId]);
        if (existingLegacy) {
          await db.run(
            `UPDATE orders
             SET user_id = ?,
                 product_name = COALESCE(?, product_name),
                 order_amount = ?,
                 estimated_cashback = ?,
                 real_cashback = ?,
                 shopee_commission = ?,
                 status = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              finalUserId,
              fields.productName,
              fields.orderAmount,
              userCashback,
              userCashback,
              fields.commission,
              mappedOrderStatus,
              fields.orderId
            ]
          );
        } else {
          await db.run(
            `INSERT INTO orders (
               id, user_id, click_id, product_name, product_image,
               order_amount, estimated_cashback, real_cashback, shopee_commission,
               status, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              fields.orderId,
              finalUserId,
              matchResult.matchedClickId || null,
              fields.productName || 'Sản phẩm Shopee',
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200',
              fields.orderAmount,
              userCashback,
              userCashback,
              fields.commission,
              mappedOrderStatus,
              fields.orderTime
            ]
          );
        }
      } catch (legacySyncErr) {
        console.warn('Orders table sync warning:', legacySyncErr.message);
      }

      // Xử lý an toàn tài chính (chỉ cộng tiền khi confirmed + shopee status approved)
      const orderForPayout = {
        order_id: fields.orderId,
        user_id: finalUserId,
        commission: fields.commission,
        shopee_status: fields.shopeeStatus,
        status: finalStatus
      };
      await creditUserCashbackIfEligible(orderForPayout, db);

      processedOrders.push({
        orderId: fields.orderId,
        userId: finalUserId,
        status: finalStatus,
        matchedBy: finalMatchedBy,
        matchScore: finalMatchScore,
        commission: fields.commission,
        shopeeStatus: fields.shopeeStatus
      });
    }

    await db.run('COMMIT');

    return res.json({
      success: true,
      message: `Đã import và đối soát thành công ${totalProcessed} đơn hàng Shopee`,
      summary: {
        totalProcessed,
        matchedBySubId,
        matchedByItemShopTime,
        needReview: needReviewCount,
        unmatched: unmatchedCount
      },
      orders: processedOrders
    });

  } catch (error) {
    const db = await getDatabase();
    await db.run('ROLLBACK');
    console.error('Import Affiliate Orders Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi import và xử lý đơn hàng: ' + error.message
    });
  }
}

/**
 * GET /api/admin/affiliate-orders/:orderId/candidates
 * Lấy danh sách candidate users được chấm điểm cho một đơn hàng cụ thể
 */
async function getOrderCandidates(req, res) {
  const { orderId } = req.params;

  try {
    const db = await getDatabase();
    const order = await db.get('SELECT * FROM affiliate_orders WHERE order_id = ? OR id = ?', [orderId, orderId]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    const matchResult = await matchOrder({
      order_id: order.order_id,
      item_id: order.item_id,
      shop_id: order.shop_id,
      order_time: order.order_time,
      shopee_click_time: order.shopee_click_time,
      sub_id1: order.sub_id1,
      sub_id2: order.sub_id2,
      sub_id3: order.sub_id3,
      sub_id4: order.sub_id4,
      sub_id5: order.sub_id5
    }, db);

    return res.json({
      success: true,
      orderId: order.order_id,
      status: order.status,
      currentUserId: order.user_id,
      matchResult
    });

  } catch (error) {
    console.error('Get Order Candidates Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách candidate: ' + error.message
    });
  }
}

/**
 * GET /api/admin/affiliate-orders/:orderId/audit-logs
 * Lấy lịch sử can thiệp/xác nhận của admin cho đơn hàng
 */
async function getOrderAuditLogs(req, res) {
  const { orderId } = req.params;

  try {
    const db = await getDatabase();
    const logs = await db.all(
      `SELECT a.*, u.name as admin_name, u.email as admin_email
       FROM order_match_audit_logs a
       LEFT JOIN users u ON a.admin_id = u.id
       WHERE a.order_id = ?
       ORDER BY a.created_at DESC`,
      [orderId]
    );

    return res.json({
      success: true,
      orderId,
      auditLogs: logs
    });

  } catch (error) {
    console.error('Get Order Audit Logs Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy audit logs: ' + error.message
    });
  }
}

module.exports = {
  getAffiliateOrders,
  confirmAffiliateOrder,
  importAffiliateOrders,
  getOrderCandidates,
  getOrderAuditLogs
};
