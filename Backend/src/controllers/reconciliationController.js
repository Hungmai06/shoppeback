const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getDatabase } = require('../config/db');

// Helper to normalize strings for header mapping
function normalizeHeader(header) {
  return header.toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese accents
    .replace(/[^a-z0-9]/g, ''); // keep only alphanumeric
}

// Extract row fields using standard mapping
function extractRowFields(row) {
  let orderId = '';
  let subId = '';
  let productName = '';
  let orderAmount = 0;
  let commission = 0;
  let shopeeStatus = '';
  let purchaseTime = null;

  // Build a normalized key map for fast lookup
  const normMap = {};
  for (const [key, val] of Object.entries(row)) {
    normMap[normalizeHeader(key)] = { key, val: (val || '').trim() };
  }

  // === ORDER ID ===
  // Priority: "ID đơn hàng" > "Mã đơn hàng" > ordersn/orderid
  for (const normKey of ['iddonhang', 'madonhang', 'ordersn', 'orderid', 'id', 'sn']) {
    if (normMap[normKey] && normMap[normKey].val) {
      orderId = normMap[normKey].val;
      break;
    }
  }
  if (!orderId) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('iddon') || nk.includes('madon') || nk.includes('ordersn')) && entry.val) {
        orderId = entry.val;
        break;
      }
    }
  }

  // === SUB ID (User identifier) ===
  // Priority: "Sub_id1" exact match
  for (const normKey of ['subid1', 'subid', 'sub1']) {
    if (normMap[normKey] !== undefined) {
      subId = normMap[normKey].val;
      break;
    }
  }
  if (!subId) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if (nk.includes('subid1') || nk.includes('subid')) {
        subId = entry.val;
        break;
      }
    }
  }

  // === PRODUCT NAME ===
  // Priority: "Tên Item" > "Tên sản phẩm" > product/item
  for (const normKey of ['tenitem', 'tensanpham', 'itemname', 'productname', 'tensp']) {
    if (normMap[normKey] && normMap[normKey].val) {
      productName = normMap[normKey].val;
      break;
    }
  }
  if (!productName) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('tenitem') || nk.includes('tensanpham') || nk.includes('itemname') || nk.includes('productname')) && entry.val) {
        productName = entry.val;
        break;
      }
    }
  }

  // === ORDER AMOUNT ===
  // Shopee CSV: "Giá trị đơn hàng (₫)" → normKey = "giatridonhangd"
  // Priority exact: "giatridonhangd", "giatridonhang", "ordervalue"
  const amountCandidates = [
    'giatridonhangd', 'giatridonhang', 'giatrionhangd', 'giatrionhang',
    'ordervalue', 'tongtien', 'orderamount'
  ];
  for (const normKey of amountCandidates) {
    if (normMap[normKey] && normMap[normKey].val) {
      const parsed = parseFloat(normMap[normKey].val.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        orderAmount = parsed;
        break;
      }
    }
  }
  if (!orderAmount) {
    // Fallback partial: look for giatri + don
    for (const [nk, entry] of Object.entries(normMap)) {
      if (nk.includes('giatridon') && entry.val) {
        const parsed = parseFloat(entry.val.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(parsed) && parsed > 0) { orderAmount = parsed; break; }
      }
    }
  }

  // === COMMISSION ===
  // Shopee CSV: "Hoa hồng ròng tiếp thị liên kết(₫)" → normKey = "hoahongrongtipthi..."
  // Also: "Tổng hoa hồng đơn hàng(₫)" → "tonghoahongdonhangd"
  // Also: "Hoa hồng đơn hàng từ Shopee(₫)" → "hoahongdonhangtushopeed"
  const commCandidates = [
    'hoahongrongtipthilienketd',     // Hoa hồng ròng tiếp thị liên kết(₫)
    'hoahongrongtipthilienket',
    'tonghoahongdonhangd',            // Tổng hoa hồng đơn hàng(₫)
    'tonghoahongdonhang',
    'hoahongdonhangtushopeed',        // Hoa hồng đơn hàng từ Shopee(₫)
    'hoahongdonhangtushopee',
    'tonghoahongsanphamd',
    'tonghoahongsanpham',
    'hoahong',
    'commission'
  ];
  for (const normKey of commCandidates) {
    if (normMap[normKey] && normMap[normKey].val) {
      const parsed = parseFloat(normMap[normKey].val.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(parsed)) {
        commission = parsed;
        break;
      }
    }
  }
  if (!commission) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('hoahong') || nk.includes('commission')) && entry.val) {
        const parsed = parseFloat(entry.val.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(parsed) && parsed > 0) { commission = parsed; break; }
      }
    }
  }

  // === STATUS ===
  // Priority: "Trạng thái đặt hàng" first, then product status
  // "Trạng thái đặt hàng" → "trangthaidathang"
  // "Trạng thái sản phẩm liên kết" → "trangthaisanphamlienket"
  for (const normKey of ['trangthaidathang', 'trangthaidonhang', 'trangthai', 'status']) {
    if (normMap[normKey] && normMap[normKey].val) {
      shopeeStatus = normMap[normKey].val;
      break;
    }
  }

  // === PURCHASE TIME ===
  // "Thời Gian Đặt Hàng" → "thoigiandathang"
  for (const normKey of ['thoigiandathang', 'thoigiantao', 'thoigiandat', 'purchasetime', 'ordertime']) {
    if (normMap[normKey] && normMap[normKey].val) {
      purchaseTime = normMap[normKey].val;
      break;
    }
  }
  if (!purchaseTime) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('thoigian') || nk.includes('ngaydat')) && entry.val) {
        purchaseTime = entry.val;
        break;
      }
    }
  }

  return {
    orderId,
    subId,
    productName,
    orderAmount,
    commission,
    shopeeStatus,
    purchaseTime
  };
}

// Helper to detect CSV delimiter
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

// Map Shopee CSV Status to System Status
function mapShopeeStatus(shopeeStatus) {
  if (!shopeeStatus) return 'pending';
  const status = shopeeStatus.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    status.includes('hoan hang') ||
    status.includes('tra hang') ||
    status.includes('returned') ||
    status.includes('refunded')
  ) {
    return 'returned';
  }

  if (
    status.includes('hoan thanh') ||
    status.includes('thanh cong') ||
    status.includes('completed') ||
    status.includes('approved') ||
    status.includes('da thanh toan') ||
    status.includes('paid') ||
    status.includes('giao thanh cong')
  ) {
    return 'approved';
  }

  if (
    status.includes('huy') ||
    status.includes('tu choi') ||
    status.includes('rejected') ||
    status.includes('cancelled') ||
    status.includes('that bai')
  ) {
    return 'rejected';
  }

  return 'pending';
}

// Helper to group rows by orderId and count invalid rows
function groupRowsByOrderId(rows) {
  const grouped = new Map();
  let invalidCount = 0;

  for (const row of rows) {
    const fields = extractRowFields(row);
    if (!fields.orderId) {
      invalidCount++;
      continue;
    }

    const lowerId = fields.orderId.toLowerCase();
    if (!grouped.has(lowerId)) {
      grouped.set(lowerId, {
        orderId: fields.orderId,
        subId: fields.subId || '',
        productNames: fields.productName ? [fields.productName] : [],
        orderAmount: fields.orderAmount || 0,
        commission: fields.commission || 0,
        shopeeStatus: fields.shopeeStatus || '',
        purchaseTime: fields.purchaseTime
      });
    } else {
      const existing = grouped.get(lowerId);
      
      // Update subId if existing is empty
      if (!existing.subId && fields.subId) {
        existing.subId = fields.subId;
      }
      
      // Add product name if not already included
      if (fields.productName && !existing.productNames.includes(fields.productName)) {
        existing.productNames.push(fields.productName);
      }
      
      // Sum amounts and commission
      existing.orderAmount += fields.orderAmount || 0;
      existing.commission += fields.commission || 0;
      
      // Update status if needed
      if (fields.shopeeStatus && !existing.shopeeStatus) {
        existing.shopeeStatus = fields.shopeeStatus;
      }
      
      // Update purchaseTime if not set
      if (!existing.purchaseTime && fields.purchaseTime) {
        existing.purchaseTime = fields.purchaseTime;
      }
    }
  }

  const orders = Array.from(grouped.values()).map(item => {
    let combinedName = item.productNames.join(' + ');
    if (combinedName.length > 250) {
      combinedName = combinedName.substring(0, 247) + '...';
    }
    
    return {
      orderId: item.orderId,
      subId: item.subId,
      productName: combinedName || 'Sản phẩm mua từ Shopee',
      orderAmount: item.orderAmount,
      commission: item.commission,
      shopeeStatus: item.shopeeStatus,
      purchaseTime: item.purchaseTime
    };
  });

  return { orders, invalidCount };
}

async function uploadAndAnalyze(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'Vui lòng tải lên file CSV đối soát' });
  }

  const tempFilePath = req.file.path;
  
  // Xóa các file cũ trong thư mục uploads (quá 1 giờ) để tránh bị đầy
  try {
    const uploadDir = path.dirname(tempFilePath);
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const now = Date.now();
      for (const file of files) {
        if (file !== '.gitkeep' && file !== path.basename(tempFilePath)) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > 3600000) { // 1 giờ
            fs.unlinkSync(filePath);
          }
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi dọn dẹp file cũ:', err);
  }

  const db = await getDatabase();
  
  const report = {
    fileName: req.file.originalname,
    tempFileName: req.file.filename,
    totalRows: 0,
    matchedCount: 0,
    duplicateCount: 0,
    invalidCount: 0,
    missingCount: 0,
    details: []
  };

  try {
    // Read all users to validate sub_id (userId or affiliate_sub_id)
    const allUsers = await db.all('SELECT id, affiliate_sub_id FROM users');
    const userIds = new Set(allUsers.map(u => u.id));
    const affiliateSubIdToUserIdMap = new Map();
    for (const u of allUsers) {
      if (u.affiliate_sub_id) affiliateSubIdToUserIdMap.set(u.affiliate_sub_id, u.id);
    }

    // Read all click_logs and affiliate_clicks to map random clickId/sub_id -> user_id
    const allClickLogs = await db.all('SELECT id, user_id, sub_id FROM click_logs WHERE user_id IS NOT NULL');
    const allAffClicks = await db.all('SELECT id, click_id, user_id, sub_id FROM affiliate_clicks WHERE user_id IS NOT NULL');
    const clickSubIdToUserIdMap = new Map();
    for (const log of allClickLogs) {
      if (log.id && log.user_id) clickSubIdToUserIdMap.set(log.id, log.user_id);
      if (log.sub_id && log.user_id) clickSubIdToUserIdMap.set(log.sub_id, log.user_id);
    }
    for (const log of allAffClicks) {
      if (log.id && log.user_id) clickSubIdToUserIdMap.set(log.id, log.user_id);
      if (log.click_id && log.user_id) clickSubIdToUserIdMap.set(log.click_id, log.user_id);
      if (log.sub_id && log.user_id) clickSubIdToUserIdMap.set(log.sub_id, log.user_id);
    }

    // Read all existing orders
    const allOrders = await db.all('SELECT id, status, user_id, order_amount, real_cashback, estimated_cashback FROM orders');
    const existingOrdersMap = new Map(allOrders.map(o => [
      o.id.toLowerCase(), 
      { 
        id: o.id, 
        status: o.status, 
        userId: o.user_id,
        orderAmount: o.order_amount,
        cashback: o.real_cashback || o.estimated_cashback || 0
      }
    ]));

    // Get system settings for cashback percentage calculation (default 50%)
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    const rawRows = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(tempFilePath)
        .pipe(csv({ separator: detectSeparator(tempFilePath) }))
        .on('data', (row) => {
          rawRows.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    report.totalRows = rawRows.length;
    const { orders: ordersToProcess, invalidCount } = groupRowsByOrderId(rawRows);
    report.invalidCount = invalidCount;

    if (invalidCount > 0) {
      report.details.push({
        id: 'INVALID_ROW',
        name: 'Dòng không hợp lệ',
        amount: 0,
        cashback: 0,
        subId: '',
        shopeeStatus: '',
        status: 'invalid',
        reason: `Có ${invalidCount} dòng không tìm thấy Mã đơn hàng trong tệp CSV`
      });
    }

    for (const order of ordersToProcess) {
      const { orderId, subId, productName, orderAmount, commission, shopeeStatus } = order;

      // Clean SubID (sometimes sub_id contains spaces or @)
      const cleanSubId = subId ? subId.trim() : '';

      // Determine Status
      const mappedStatus = mapShopeeStatus(shopeeStatus);

      const lowerOrderId = orderId.toLowerCase();
      const exists = existingOrdersMap.has(lowerOrderId);
      const dbOrder = exists ? existingOrdersMap.get(lowerOrderId) : null;
      const currentDbStatus = dbOrder ? dbOrder.status : '';
      const currentDbUserId = dbOrder ? dbOrder.userId : '';

      // Determine targetUserId:
      // - If CSV has a valid subId that exists in system → use it
      // - If CSV has a subId that does NOT exist in system → mark as missing (likely typo)
      // - If CSV has no subId but order exists → keep existing user_id
      // - If CSV has no subId and order is new → import with null user_id (unassigned)
      let targetUserId = null;
      if (cleanSubId) {
        if (clickSubIdToUserIdMap.has(cleanSubId)) {
          targetUserId = clickSubIdToUserIdMap.get(cleanSubId);
        } else if (userIds.has(cleanSubId)) {
          targetUserId = cleanSubId;
        } else if (affiliateSubIdToUserIdMap.has(cleanSubId)) {
          targetUserId = affiliateSubIdToUserIdMap.get(cleanSubId);
        }
      }

      if (!targetUserId) {
        if (exists) {
          targetUserId = currentDbUserId || null; // keep existing
        } else {
          targetUserId = null; // new unassigned order
        }
      }

      const userCashback = Math.round((commission || 0) * cashbackRate);

      // Process Match / Duplicate for existing or new order
      if (exists) {
        const amountChanged = Math.abs((dbOrder.orderAmount || 0) - (orderAmount || 0)) > 1;
        const commissionChanged = Math.abs((dbOrder.cashback || 0) - (userCashback || 0)) > 1;
        const isDuplicate = currentDbStatus === mappedStatus && currentDbUserId === targetUserId && !amountChanged && !commissionChanged;

        if (currentDbStatus === 'paid') {
          report.duplicateCount++;
          report.details.push({
            id: orderId,
            name: productName || 'Sản phẩm đã thanh toán',
            amount: orderAmount,
            cashback: userCashback,
            subId: targetUserId,
            shopeeStatus: mappedStatus,
            status: 'duplicate',
            reason: 'Đơn hàng này đã được thanh toán vào ví trước đó'
          });
        } else if (isDuplicate) {
          report.duplicateCount++;
          report.details.push({
            id: orderId,
            name: productName,
            amount: orderAmount,
            cashback: userCashback,
            subId: targetUserId,
            shopeeStatus: mappedStatus,
            status: 'duplicate',
            reason: `Đơn hàng đã tồn tại và không có thay đổi mới.`
          });
        } else {
          // State differs, user_id differs, or amounts differ
          let changeReason = '';
          if (currentDbUserId !== targetUserId) {
            changeReason = `Cập nhật thành viên từ ${currentDbUserId || 'trống'} -> ${targetUserId || 'trống'}`;
          }
          if (currentDbStatus !== mappedStatus) {
            changeReason += (changeReason ? ' & ' : '') + `Cập nhật trạng thái từ ${currentDbStatus} -> ${mappedStatus}`;
          }
          if (amountChanged || commissionChanged) {
            changeReason += (changeReason ? ' & ' : '') + `Cập nhật số tiền/hoa hồng`;
          }

          report.matchedCount++;
          report.details.push({
            id: orderId,
            name: productName,
            amount: orderAmount,
            cashback: userCashback,
            subId: targetUserId,
            shopeeStatus: mappedStatus,
            status: 'matched',
            reason: changeReason || 'Cập nhật thông tin đơn hàng'
          });
        }
      } else {
        // Totally new order
        report.matchedCount++;
        report.details.push({
          id: orderId,
          name: productName,
          amount: orderAmount,
          cashback: userCashback,
          subId: targetUserId,
          shopeeStatus: mappedStatus,
          status: 'matched',
          reason: targetUserId
            ? `Tạo đơn hàng mới cho User ${targetUserId} ở trạng thái ${mappedStatus}`
            : `Tạo đơn hàng mới (chưa xác định thành viên) ở trạng thái ${mappedStatus}`
        });
      }
    }

    res.json(report);
  } catch (error) {
    console.error('CSV Parsing Error:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra khi xử lý file CSV đối soát' });
  }
}


async function applyReconciliation(req, res) {
  const { tempFileName } = req.body;

  if (!tempFileName) {
    return res.status(400).json({ message: 'Thiếu tên file đối soát tạm thời' });
  }

  const tempFilePath = path.resolve(__dirname, '../../uploads', tempFileName);
  
  if (!fs.existsSync(tempFilePath)) {
    return res.status(404).json({ message: 'Không tìm thấy file đối soát hoặc file đã bị xóa' });
  }

  try {
    const db = await getDatabase();
    
    // Fetch users, click_logs, orders for sync
    const allUsers = await db.all('SELECT id, affiliate_sub_id FROM users');
    const userIds = new Set(allUsers.map(u => u.id));
    const affiliateSubIdToUserIdMap = new Map();
    for (const u of allUsers) {
      if (u.affiliate_sub_id) affiliateSubIdToUserIdMap.set(u.affiliate_sub_id, u.id);
    }

    const allClickLogs = await db.all('SELECT id, user_id, sub_id FROM click_logs WHERE user_id IS NOT NULL');
    const allAffClicks = await db.all('SELECT id, click_id, user_id, sub_id FROM affiliate_clicks WHERE user_id IS NOT NULL');
    const clickSubIdToUserIdMap = new Map();
    const clickIdMap = new Map();
    for (const log of allClickLogs) {
      if (log.id && log.user_id) {
        clickSubIdToUserIdMap.set(log.id, log.user_id);
        clickIdMap.set(log.id, log.id);
      }
      if (log.sub_id && log.user_id) {
        clickSubIdToUserIdMap.set(log.sub_id, log.user_id);
        clickIdMap.set(log.sub_id, log.id);
      }
    }
    for (const log of allAffClicks) {
      if (log.id && log.user_id) {
        clickSubIdToUserIdMap.set(log.id, log.user_id);
        clickIdMap.set(log.id, log.id);
      }
      if (log.click_id && log.user_id) {
        clickSubIdToUserIdMap.set(log.click_id, log.user_id);
        clickIdMap.set(log.click_id, log.id);
      }
      if (log.sub_id && log.user_id) {
        clickSubIdToUserIdMap.set(log.sub_id, log.user_id);
        clickIdMap.set(log.sub_id, log.id);
      }
    }

    const allOrders = await db.all('SELECT id, status, user_id, order_amount, real_cashback, estimated_cashback FROM orders');
    const existingOrdersMap = new Map(allOrders.map(o => [
      o.id.toLowerCase(), 
      { 
        id: o.id, 
        status: o.status, 
        userId: o.user_id,
        orderAmount: o.order_amount,
        cashback: o.real_cashback || o.estimated_cashback || 0
      }
    ]));

    let insertedCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;

    const rawRows = [];

    // Parse the file again synchronously or accumulate in memory first
    await new Promise((resolve, reject) => {
      fs.createReadStream(tempFilePath)
        .pipe(csv({ separator: detectSeparator(tempFilePath) }))
        .on('data', (row) => {
          rawRows.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const { orders: ordersToProcess, invalidCount } = groupRowsByOrderId(rawRows);
    ignoredCount += invalidCount;

    // Get system settings for cashback percentage calculation
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    // Begin transaction simulator
    await db.run('BEGIN TRANSACTION');

    for (const order of ordersToProcess) {
      const { orderId, subId, productName, orderAmount, commission, shopeeStatus, purchaseTime } = order;

      const cleanSubId = subId ? subId.trim() : '';
      const mappedStatus = mapShopeeStatus(shopeeStatus);
      const lowerOrderId = orderId.toLowerCase();
      const exists = existingOrdersMap.has(lowerOrderId);
      const dbOrder = exists ? existingOrdersMap.get(lowerOrderId) : null;
      const currentDbStatus = dbOrder ? dbOrder.status : '';
      const currentDbUserId = dbOrder ? dbOrder.userId : null;

      let targetUserId = null;
      let targetClickId = null;
      if (cleanSubId) {
        if (clickSubIdToUserIdMap.has(cleanSubId)) {
          targetUserId = clickSubIdToUserIdMap.get(cleanSubId);
          targetClickId = clickIdMap.get(cleanSubId) || null;
        } else if (userIds.has(cleanSubId)) {
          targetUserId = cleanSubId;
        } else if (affiliateSubIdToUserIdMap.has(cleanSubId)) {
          targetUserId = affiliateSubIdToUserIdMap.get(cleanSubId);
        }
      }

      if (!targetUserId) {
        if (exists) {
          targetUserId = currentDbUserId || null; // keep existing user
        } else {
          targetUserId = null; // new unassigned order, allowed
        }
      }

      const userCashback = Math.round((commission || 0) * cashbackRate);

      if (exists) {
        if (currentDbStatus === 'paid') {
          // Already paid, do not touch it
          ignoredCount++;
          continue;
        }

        const statusChanged = currentDbStatus !== mappedStatus;
        const userChanged = currentDbUserId !== targetUserId;
        const amountChanged = Math.abs((dbOrder.orderAmount || 0) - (orderAmount || 0)) > 1;
        const commissionChanged = Math.abs((dbOrder.cashback || 0) - (userCashback || 0)) > 1;

        if (!statusChanged && !userChanged && !amountChanged && !commissionChanged) {
          // Nothing to update, skip silently
          ignoredCount++;
          continue;
        }

        // Only update if something actually changed
        await db.run(
          `UPDATE orders
           SET status = ?,
               user_id = ?,
               real_cashback = ?,
               shopee_commission = ?,
               order_amount = ?,
               product_name = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [mappedStatus, targetUserId, userCashback, commission, orderAmount, productName, dbOrder.id]
        );

        // Calculate and add money to user if status transitioned to approved
        if (targetUserId && mappedStatus === 'approved' && currentDbStatus !== 'approved') {
          const userCashback = commission * cashbackRate;
          await db.run(
            `UPDATE users 
             SET balance = COALESCE(balance, 0) + ?,
                 total_cashback = COALESCE(total_cashback, 0) + ?
             WHERE id = ?`,
            [userCashback, userCashback, targetUserId]
          );

          // Check for referral bonus (20% of user cashback)
          const targetUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [targetUserId]);
          if (targetUserObj && targetUserObj.referred_by) {
            const refBonus = userCashback * 0.20;
            await db.run(
              `UPDATE users 
               SET balance = COALESCE(balance, 0) + ?,
                   referral_earnings = COALESCE(referral_earnings, 0) + ?
               WHERE id = ?`,
              [refBonus, refBonus, targetUserObj.referred_by]
            );
            const refNotifId = `NT${Date.now()}${Math.floor(Math.random()*100)}`;
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, 'Hoa hồng giới thiệu', ?, 'system')`,
              [refNotifId, targetUserObj.referred_by, `Bạn nhận được +${Math.round(refBonus).toLocaleString('vi-VN')}đ hoa hồng giới thiệu từ giao dịch của thành viên.`]
            );
          }
        }

        // Notify user only if status changed to approved OR user_id reassigned (and user exists)
        if (targetUserId && ((statusChanged && mappedStatus === 'approved') || userChanged)) {
          const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
          const amountDisplay = (commission * cashbackRate).toLocaleString('vi-VN');
          await db.run(
            `INSERT INTO notifications (id, user_id, title, content, type)
             VALUES (?, ?, ?, ?, 'order')`,
            [
              notifId,
              targetUserId,
              'Đơn hàng đã được duyệt hoàn tiền',
              `Đơn hàng ${orderId} (${productName.substring(0, 20)}...) đã đối soát thành công cho bạn. Số tiền hoàn +${amountDisplay}đ đã được cộng.`
            ]
          );
        }

        updatedCount++;
      } else {
        // Insert new order
        const orderTime = purchaseTime || new Date().toISOString().replace('T', ' ').substring(0, 19);

        await db.run(
          `INSERT INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            orderId,
            targetUserId,
            targetClickId,
            productName,
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200', // default shopee image placeholder
            orderAmount,
            userCashback, // 50% cashback for user
            userCashback, // 50% cashback for user
            commission,   // 100% total shopee commission for admin
            mappedStatus,
            orderTime
          ]
        );

        // Calculate and add money to user if new order is already approved
        // Calculate and add money to user if new order is already approved
        if (targetUserId && mappedStatus === 'approved') {
          const userCashback = commission * cashbackRate;
          await db.run(
            `UPDATE users 
             SET balance = COALESCE(balance, 0) + ?,
                 total_cashback = COALESCE(total_cashback, 0) + ?
             WHERE id = ?`,
            [userCashback, userCashback, targetUserId]
          );

          // Check for referral bonus (20%)
          const targetUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [targetUserId]);
          if (targetUserObj && targetUserObj.referred_by) {
            const refBonus = userCashback * 0.20;
            await db.run(
              `UPDATE users 
               SET balance = COALESCE(balance, 0) + ?,
                   referral_earnings = COALESCE(referral_earnings, 0) + ?
               WHERE id = ?`,
              [refBonus, refBonus, targetUserObj.referred_by]
            );
            const refNotifId = `NT${Date.now()}${Math.floor(Math.random()*100)}`;
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, 'Hoa hồng giới thiệu', ?, 'system')`,
              [refNotifId, targetUserObj.referred_by, `Bạn nhận được +${Math.round(refBonus).toLocaleString('vi-VN')}đ hoa hồng từ giao dịch của người bạn giới thiệu.`]
            );
          }
        }

        // Notify only if user is assigned
        if (targetUserId) {
          if (mappedStatus === 'approved') {
            const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
            const amountDisplay = (commission * cashbackRate).toLocaleString('vi-VN');
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, ?, ?, 'order')`,
              [
                notifId,
                targetUserId,
                'Đơn hàng ghi nhận & đã duyệt',
                `Đơn hàng mới ${orderId} (${productName.substring(0, 20)}...) đã được thêm và duyệt thành công. Tiền hoàn +${amountDisplay}đ đã được cộng.`
              ]
            );
          } else {
            const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, ?, ?, 'order')`,
              [
                notifId,
                targetUserId,
                'Đơn hàng mới được ghi nhận',
                `Đơn hàng Shopee ${orderId} trị giá ${orderAmount.toLocaleString('vi-VN')}đ đã được cập nhật vào lịch sử. Đang chờ đối soát.`
              ]
            );
          }
        }

        insertedCount++;
      }
    }

    // Insert reconciliation log
    const logId = `REC${Date.now()}`;
    await db.run(
      `INSERT INTO reconciliation_logs (id, file_name, total_rows, matched_count, duplicate_count, invalid_count, missing_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        path.basename(tempFilePath),
        rawRows.length,
        insertedCount + updatedCount,
        ignoredCount,
        invalidCount,
        0
      ]
    );

    // Commit Transaction
    await db.run('COMMIT');

    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      message: 'Áp dụng kết quả đối soát thành công',
      summary: {
        inserted: insertedCount,
        updated: updatedCount,
        ignored: ignoredCount,
        totalProcessed: rawRows.length
      }
    });
  } catch (error) {
    // Rollback in case of failure
    const db = await getDatabase();
    await db.run('ROLLBACK');

    console.error('Apply Reconciliation Error:', error);
    
    // Clean up temporary file even on error
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Failed to delete temp file on error:', e);
      }
    }

    res.status(500).json({ 
      message: 'Thất bại khi thực thi đối soát và cập nhật đơn hàng: ' + error.message,
      error: error.message,
      stack: error.stack
    });
  }
}

async function getReconciliationLogs(req, res) {
  try {
    const db = await getDatabase();
    const logs = await db.all('SELECT * FROM reconciliation_logs ORDER BY upload_time DESC');
    res.json(logs);
  } catch (error) {
    console.error('Get Reconciliation Logs Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy lịch sử đối soát' });
  }
}

module.exports = {
  uploadAndAnalyze,
  applyReconciliation,
  getReconciliationLogs
};
