const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { getDatabase } = require('../config/db');

async function readRowsFromFile(filePath, originalName = '') {
  const ext = path.extname(originalName || filePath).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: false, cellDates: true });
      if (workbook.SheetNames && workbook.SheetNames.length > 0) {
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }
    } catch (e) {
      console.warn('XLSX binary read warning:', e.message);
    }
  }

  // Read string for CSV/TSV/text files to preserve UTF-8 Vietnamese headers and characters
  try {
    const fileStr = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const workbook = XLSX.read(fileStr, { type: 'string', raw: false });
    if (workbook.SheetNames && workbook.SheetNames.length > 0) {
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (rows && rows.length > 0) {
        return rows;
      }
    }
  } catch (e) {
    console.warn('XLSX text read warning, falling back to csv-parser:', e.message);
  }

  // Fallback to csv-parser with mapHeaders for BOM stripping
  const rawRows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({
        separator: detectSeparator(filePath),
        mapHeaders: ({ header }) => (header || '').replace(/^\uFEFF/, '').trim()
      }))
      .on('data', (row) => {
        rawRows.push(row);
      })
      .on('end', resolve)
      .on('error', reject);
  });
  return rawRows;
}

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
    const strVal = (val !== null && val !== undefined) ? String(val).trim() : '';
    normMap[normalizeHeader(key)] = { key, val: strVal };
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

  // === PURCHASE TIME & CLICK TIME ===
  // "Thời Gian Đặt Hàng" → "thoigiandathang", "Thời gian Click" → "thoigianclick"
  for (const normKey of ['thoigiandathang', 'thoigiantao', 'thoigiandat', 'purchasetime', 'ordertime']) {
    if (normMap[normKey] && normMap[normKey].val) {
      purchaseTime = normMap[normKey].val;
      break;
    }
  }
  if (!purchaseTime) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('thoigian') || nk.includes('ngaydat')) && !nk.includes('click') && entry.val) {
        purchaseTime = entry.val;
        break;
      }
    }
  }

  let clickTime = null;
  for (const normKey of ['thoigianclick', 'clicktime', 'thoidiemclick']) {
    if (normMap[normKey] && normMap[normKey].val) {
      clickTime = normMap[normKey].val;
      break;
    }
  }

  // === SHOP ID & ITEM ID ===
  let shopId = '';
  let itemId = '';
  for (const normKey of ['shopid', 'idshop']) {
    if (normMap[normKey] && normMap[normKey].val) {
      shopId = normMap[normKey].val;
      break;
    }
  }
  for (const normKey of ['itemid', 'iditem', 'productid', 'idproduct']) {
    if (normMap[normKey] && normMap[normKey].val) {
      itemId = normMap[normKey].val;
      break;
    }
  }

  return {
    orderId,
    subId,
    productName,
    orderAmount,
    commission,
    shopeeStatus,
    purchaseTime,
    clickTime,
    shopId,
    itemId
  };
}

// Helper to format any date input (Excel serial number, VN string, ISO string) into MySQL DATETIME 'YYYY-MM-DD HH:mm:ss'
function formatToMySQLDateTime(val) {
  if (!val) {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }

  const str = String(val).trim();
  if (!str) {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  // 1. Excel date serial number (e.g., 46275.93922453704)
  const num = Number(str);
  if (!isNaN(num) && num > 20000 && num < 100000) {
    const dateMs = (num - 25569) * 86400 * 1000;
    const date = new Date(dateMs);
    if (!isNaN(date.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    }
  }

  // 2. Vietnam Shopee Date format: e.g. "9/10/2026 22:32", "09/10/2026 22:32:00"
  const vnMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (vnMatch) {
    const day = String(vnMatch[1]).padStart(2, '0');
    const month = String(vnMatch[2]).padStart(2, '0');
    const year = vnMatch[3];
    const hour = vnMatch[4] ? String(vnMatch[4]).padStart(2, '0') : '00';
    const minute = vnMatch[5] ? String(vnMatch[5]).padStart(2, '0') : '00';
    const second = vnMatch[6] ? String(vnMatch[6]).padStart(2, '0') : '00';
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // 3. ISO / Standard SQL datetime format: e.g. "2026-09-10 22:32:00" or "2026-09-10T22:32:00.000Z"
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(isoMatch[2]).padStart(2, '0');
    const day = String(isoMatch[3]).padStart(2, '0');
    const hour = isoMatch[4] ? String(isoMatch[4]).padStart(2, '0') : '00';
    const minute = isoMatch[5] ? String(isoMatch[5]).padStart(2, '0') : '00';
    const second = isoMatch[6] ? String(isoMatch[6]).padStart(2, '0') : '00';
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // 4. Standard JS Date parse fallback
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
  }

  return new Date().toISOString().replace('T', ' ').substring(0, 19);
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

/**
 * Thuật toán quét đối soát nghiêm ngặt (Strict Matching):
 * Dựa vào ID sản phẩm (Item Id), ID Shop (Shop Id), Tên Item, Thời gian đặt hàng và Thời gian Click từ file CSV.
 * Chỉ gán đơn khi vừa KHỚP ĐÚNG SẢN PHẨM/SHOP VÀ nằm trong KHUNG GIỜ NGẮN (< 2 tiếng).
 * Nếu không thỏa mãn cả 2 điều kiện nghiêm ngặt này -> Giữ nguyên user_id = null (Chưa xác định thành viên).
 */
function findSmartMatchedUser(purchaseTimeStr, productName, orderAmount, allClickLogsFull, pendingOrders, extraOptions = {}) {
  const { clickTimeStr, shopId, itemId } = extraOptions;
  if (!purchaseTimeStr && !clickTimeStr) return null;

  let purchaseMs = 0;
  if (purchaseTimeStr) {
    try {
      const formatted = formatToMySQLDateTime(purchaseTimeStr);
      const dateObj = new Date(formatted.replace(' ', 'T'));
      if (!isNaN(dateObj.getTime())) {
        purchaseMs = dateObj.getTime();
      }
    } catch (e) {}
  }

  let csvClickMs = 0;
  if (clickTimeStr) {
    try {
      const formatted = formatToMySQLDateTime(clickTimeStr);
      const dateObj = new Date(formatted.replace(' ', 'T'));
      if (!isNaN(dateObj.getTime())) {
        csvClickMs = dateObj.getTime();
      }
    } catch (e) {}
  }

  const baseRefMs = purchaseMs || csvClickMs;
  if (!baseRefMs) return null;

  // Khung giờ nghiêm ngặt: Tối đa 2 tiếng trước thời điểm mua hàng
  const maxWindowMs = 2 * 3600 * 1000;
  const candidateScores = new Map();

  // Helper kiểm tra trùng khớp mã sản phẩm / shop ID / tên sản phẩm
  const isProductMatch = (pName, pUrlOrName) => {
    if (!pName && !pUrlOrName && !itemId && !shopId) return false;
    const p1 = (pName || '').toLowerCase();
    const p2 = (pUrlOrName || '').toLowerCase();

    // 1. Khớp theo Item ID trực tiếp từ CSV
    if (itemId && String(itemId).trim().length >= 4) {
      const cleanItemId = String(itemId).trim().toLowerCase();
      if (p1.includes(cleanItemId) || p2.includes(cleanItemId)) {
        return true;
      }
    }

    // 2. Khớp theo Shop ID trực tiếp từ CSV
    if (shopId && String(shopId).trim().length >= 4) {
      const cleanShopId = String(shopId).trim().toLowerCase();
      if (p1.includes(cleanShopId) || p2.includes(cleanShopId)) {
        return true;
      }
    }

    // 3. Tra cứu Regex Item ID / Shop ID từ URL (ví dụ i.123456.78910 hoặc product/123/456)
    const matchItem1 = p1.match(/i\.(\d+)\.(\d+)/) || p1.match(/product\/(\d+)\/(\d+)/) || p1.match(/\.(\d{6,})/);
    const matchItem2 = p2.match(/i\.(\d+)\.(\d+)/) || p2.match(/product\/(\d+)\/(\d+)/) || p2.match(/\.(\d{6,})/);

    if (matchItem1 && matchItem2 && matchItem1[0] === matchItem2[0]) {
      return true; // Khớp 100% Item ID / Shop ID
    }

    // 4. So sánh cụm từ tên sản phẩm
    const cleanP1 = p1.replace(/[^a-z0-9]/g, '');
    const cleanP2 = p2.replace(/[^a-z0-9]/g, '');
    if (cleanP1.length >= 6 && cleanP2.length >= 6) {
      const sub1 = cleanP1.substring(0, 15);
      const sub2 = cleanP2.substring(0, 15);
      if (cleanP1.includes(sub2) || cleanP2.includes(sub1)) {
        return true;
      }
    }

    return false;
  };

  // 1. Quét các đơn hàng pending trong CSDL
  if (pendingOrders && pendingOrders.length > 0) {
    for (const pending of pendingOrders) {
      if (!pending.user_id) continue;
      const pendingMs = new Date(pending.created_at).getTime();
      if (isNaN(pendingMs)) continue;

      const diffMs = baseRefMs - pendingMs;
      // Nằm trong khung giờ ngắn (-10 phút clock skew đến 2 tiếng)
      if (diffMs >= -600000 && diffMs <= maxWindowMs) {
        if (isProductMatch(productName, pending.product_name)) {
          let score = 90;
          if (csvClickMs) {
            const clickDiff = Math.abs(csvClickMs - pendingMs);
            if (clickDiff <= 600000) score += 10;
          }
          candidateScores.set(pending.user_id, {
            score,
            userId: pending.user_id,
            clickId: pending.click_id || pending.id,
            reason: `Khớp Đơn chờ & Sản phẩm/Shop ID trong khung giờ (${Math.max(0, Math.round(diffMs / 60000))} phút)`
          });
        }
      }
    }
  }

  // 2. Quét bảng click_logs
  if (allClickLogsFull && allClickLogsFull.length > 0) {
    for (const log of allClickLogsFull) {
      if (!log.user_id) continue;
      const clickMs = new Date(log.click_time || log.created_at).getTime();
      if (isNaN(clickMs)) continue;

      const diffMs = baseRefMs - clickMs;
      if (diffMs >= -600000 && diffMs <= maxWindowMs) {
        if (isProductMatch(productName, log.product_url)) {
          let score = 80;
          if (csvClickMs) {
            const clickDiff = Math.abs(csvClickMs - clickMs);
            if (clickDiff <= 600000) score += 15;
          }
          const existing = candidateScores.get(log.user_id) || { score: 0 };
          if (score > existing.score) {
            candidateScores.set(log.user_id, {
              score,
              userId: log.user_id,
              clickId: log.id,
              reason: `Khớp Mã/Tên sản phẩm/Shop ID & Khung giờ click (${Math.max(0, Math.round(diffMs / 60000))} phút)`
            });
          }
        }
      }
    }
  }

  if (candidateScores.size === 0) return null;

  let best = null;
  for (const candidate of candidateScores.values()) {
    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  // Yêu cầu điểm tối thiểu 70 (BẮT BUỘC phải khớp đúng Sản phẩm/Shop ID VÀ trong khung giờ < 2 tiếng)
  if (best && best.score >= 70) {
    return best;
  }

  return null; // Nếu không đủ điều kiện nghiêm ngặt -> Giữ nguyên user_id = null (Chưa xác định thành viên)
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
        purchaseTime: fields.purchaseTime,
        clickTime: fields.clickTime || null,
        shopId: fields.shopId || '',
        itemId: fields.itemId || ''
      });
    } else {
      const existing = grouped.get(lowerId);
      
      if (!existing.subId && fields.subId) {
        existing.subId = fields.subId;
      }
      if (fields.productName && !existing.productNames.includes(fields.productName)) {
        existing.productNames.push(fields.productName);
      }
      existing.orderAmount += fields.orderAmount || 0;
      existing.commission += fields.commission || 0;
      if (fields.shopeeStatus && !existing.shopeeStatus) {
        existing.shopeeStatus = fields.shopeeStatus;
      }
      if (!existing.purchaseTime && fields.purchaseTime) {
        existing.purchaseTime = fields.purchaseTime;
      }
      if (!existing.clickTime && fields.clickTime) {
        existing.clickTime = fields.clickTime;
      }
      if (!existing.shopId && fields.shopId) {
        existing.shopId = fields.shopId;
      }
      if (!existing.itemId && fields.itemId) {
        existing.itemId = fields.itemId;
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
      purchaseTime: item.purchaseTime,
      clickTime: item.clickTime,
      shopId: item.shopId,
      itemId: item.itemId
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

    // Read all click_logs with click_time & product_url for exact & smart time-window matching
    const allClickLogsFull = await db.all('SELECT id, user_id, sub_id, product_url, click_time FROM click_logs WHERE user_id IS NOT NULL');
    const clickSubIdToUserIdMap = new Map();
    for (const log of allClickLogsFull) {
      if (log.id && log.user_id) clickSubIdToUserIdMap.set(log.id, log.user_id);
      if (log.sub_id && log.user_id) clickSubIdToUserIdMap.set(log.sub_id, log.user_id);
    }

    // Read all pending orders in system created on link click (via orderController.logClick)
    const pendingOrders = await db.all("SELECT id, user_id, click_id, product_name, order_amount, created_at FROM orders WHERE status = 'pending' AND user_id IS NOT NULL");

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

    const rawRows = await readRowsFromFile(tempFilePath, req.file.originalname);

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
      const { orderId, subId, productName, orderAmount, commission, shopeeStatus, purchaseTime, clickTime, shopId, itemId } = order;

      // Clean SubID (sometimes sub_id contains spaces or @)
      const cleanSubId = subId ? subId.trim() : '';

      // Determine Status
      const mappedStatus = mapShopeeStatus(shopeeStatus);

      const lowerOrderId = orderId.toLowerCase();
      const exists = existingOrdersMap.has(lowerOrderId);
      const dbOrder = exists ? existingOrdersMap.get(lowerOrderId) : null;
      const currentDbStatus = dbOrder ? dbOrder.status : '';
      const currentDbUserId = dbOrder ? dbOrder.userId : '';

      let targetUserId = null;
      let smartMatchInfo = null;

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
          // Smart Match fallback using click_logs & pending orders
          smartMatchInfo = findSmartMatchedUser(purchaseTime, productName, orderAmount, allClickLogsFull, pendingOrders, { clickTimeStr: clickTime, shopId, itemId });
          if (smartMatchInfo) {
            targetUserId = smartMatchInfo.userId;
          }
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
            changeReason += (changeReason ? ' & ' : '') + `Cập nhật giá đơn theo CSV (${(dbOrder.orderAmount || 0).toLocaleString('vi-VN')}đ -> ${(orderAmount || 0).toLocaleString('vi-VN')}đ)`;
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
            reason: changeReason || 'Cập nhật thông tin đơn hàng theo file CSV đối soát'
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
            ? (smartMatchInfo 
                ? `Khớp thông minh cho User ${targetUserId} (${smartMatchInfo.reason})` 
                : `Tạo đơn hàng mới cho User ${targetUserId} ở trạng thái ${mappedStatus}`)
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
    
    // Fetch users, click_logs, pending orders for sync
    const allUsers = await db.all('SELECT id, affiliate_sub_id FROM users');
    const userIds = new Set(allUsers.map(u => u.id));
    const affiliateSubIdToUserIdMap = new Map();
    for (const u of allUsers) {
      if (u.affiliate_sub_id) affiliateSubIdToUserIdMap.set(u.affiliate_sub_id, u.id);
    }

    const allClickLogsFull = await db.all('SELECT id, user_id, sub_id, product_url, click_time FROM click_logs WHERE user_id IS NOT NULL');
    const clickSubIdToUserIdMap = new Map();
    const clickIdMap = new Map();
    for (const log of allClickLogsFull) {
      if (log.id && log.user_id) {
        clickSubIdToUserIdMap.set(log.id, log.user_id);
        clickIdMap.set(log.id, log.id);
      }
      if (log.sub_id && log.user_id) {
        clickSubIdToUserIdMap.set(log.sub_id, log.user_id);
        clickIdMap.set(log.sub_id, log.id);
      }
    }

    const pendingOrders = await db.all("SELECT id, user_id, click_id, product_name, order_amount, created_at FROM orders WHERE status = 'pending' AND user_id IS NOT NULL");

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

    const rawRows = await readRowsFromFile(tempFilePath, tempFileName);

    const { orders: ordersToProcess, invalidCount } = groupRowsByOrderId(rawRows);
    ignoredCount += invalidCount;

    // Get system settings for cashback percentage calculation
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    // Begin transaction simulator
    await db.run('BEGIN TRANSACTION');

    for (const order of ordersToProcess) {
      const { orderId, subId, productName, orderAmount, commission, shopeeStatus, purchaseTime, clickTime, shopId, itemId } = order;

      const cleanSubId = subId ? subId.trim() : '';
      const mappedStatus = mapShopeeStatus(shopeeStatus);
      const lowerOrderId = orderId.toLowerCase();
      const exists = existingOrdersMap.has(lowerOrderId);
      const dbOrder = exists ? existingOrdersMap.get(lowerOrderId) : null;
      const currentDbStatus = dbOrder ? dbOrder.status : '';
      const currentDbUserId = dbOrder ? dbOrder.userId : null;

      let targetUserId = null;
      let targetClickId = null;
      let smartMatchInfo = null;

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
          // Smart Match fallback using click_logs & pending orders
          smartMatchInfo = findSmartMatchedUser(purchaseTime, productName, orderAmount, allClickLogsFull, pendingOrders, { clickTimeStr: clickTime, shopId, itemId });
          if (smartMatchInfo) {
            targetUserId = smartMatchInfo.userId;
            targetClickId = smartMatchInfo.clickId || null;
          }
        }
      }

      const userCashback = Math.round((commission || 0) * cashbackRate);

      if (exists) {
        if (currentDbStatus === 'paid') {
          // Already paid, do not touch it
          ignoredCount++;
          continue;
        }

        const oldStatus = currentDbStatus;
        const oldUserId = currentDbUserId;
        const oldCashback = dbOrder.cashback || 0;
        const newStatus = mappedStatus;
        const newUserId = targetUserId;
        const newCashback = userCashback;

        const statusChanged = oldStatus !== newStatus;
        const userChanged = oldUserId !== newUserId;
        const amountChanged = Math.abs((dbOrder.orderAmount || 0) - (orderAmount || 0)) > 1;
        const commissionChanged = Math.abs(oldCashback - newCashback) > 1;

        if (!statusChanged && !userChanged && !amountChanged && !commissionChanged) {
          // Nothing to update, skip silently
          ignoredCount++;
          continue;
        }

        // Always update order with exact CSV price, commission, cashback and product name
        await db.run(
          `UPDATE orders
           SET status = ?,
               user_id = ?,
               real_cashback = ?,
               estimated_cashback = ?,
               shopee_commission = ?,
               order_amount = ?,
               product_name = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newStatus, newUserId, newCashback, newCashback, commission, orderAmount, productName, dbOrder.id]
        );

        // 1. If order was previously approved for oldUserId, but is now NOT approved OR targetUserId changed
        const wasApproved = oldStatus === 'approved';
        const isNowApproved = newStatus === 'approved';

        if (wasApproved && oldUserId && (!isNowApproved || oldUserId !== newUserId)) {
          await db.run(
            `UPDATE users 
             SET balance = CASE WHEN COALESCE(balance, 0) >= ? THEN balance - ? ELSE 0 END,
                 total_cashback = CASE WHEN COALESCE(total_cashback, 0) >= ? THEN total_cashback - ? ELSE 0 END
             WHERE id = ?`,
            [oldCashback, oldCashback, oldCashback, oldCashback, oldUserId]
          );

          const oldUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [oldUserId]);
          if (oldUserObj && oldUserObj.referred_by) {
            const refBonus = oldCashback * 0.20;
            await db.run(
              `UPDATE users 
               SET balance = CASE WHEN COALESCE(balance, 0) >= ? THEN balance - ? ELSE 0 END,
                   referral_earnings = CASE WHEN COALESCE(referral_earnings, 0) >= ? THEN referral_earnings - ? ELSE 0 END
               WHERE id = ?`,
              [refBonus, refBonus, refBonus, refBonus, oldUserObj.referred_by]
            );
          }
        }

        // 2. If order is now approved and assigned to newUserId
        if (isNowApproved && newUserId) {
          if (!wasApproved || !oldUserId || oldUserId !== newUserId) {
            // New approval or user transfer -> credit full newCashback
            await db.run(
              `UPDATE users 
               SET balance = COALESCE(balance, 0) + ?,
                   total_cashback = COALESCE(total_cashback, 0) + ?
               WHERE id = ?`,
              [newCashback, newCashback, newUserId]
            );

            const targetUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [newUserId]);
            if (targetUserObj && targetUserObj.referred_by) {
              const refBonus = newCashback * 0.20;
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
          } else if (wasApproved && oldUserId === newUserId) {
            // Same user, adjust balance for difference between CSV price/cashback and old lookup cashback
            const diff = newCashback - oldCashback;
            if (Math.abs(diff) > 0.01) {
              await db.run(
                `UPDATE users 
                 SET balance = CASE WHEN (COALESCE(balance, 0) + ?) >= 0 THEN (COALESCE(balance, 0) + ?) ELSE 0 END,
                     total_cashback = CASE WHEN (COALESCE(total_cashback, 0) + ?) >= 0 THEN (COALESCE(total_cashback, 0) + ?) ELSE 0 END
                 WHERE id = ?`,
                [diff, diff, diff, diff, newUserId]
              );
            }
          }
        }

        // Notify user if status changed to approved or user reassigned
        if (newUserId && ((statusChanged && isNowApproved) || userChanged)) {
          const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
          const amountDisplay = newCashback.toLocaleString('vi-VN');
          await db.run(
            `INSERT INTO notifications (id, user_id, title, content, type)
             VALUES (?, ?, ?, ?, 'order')`,
            [
              notifId,
              newUserId,
              'Đơn hàng đã được đối soát & cập nhật giá CSV',
              `Đơn hàng ${orderId} (${(productName || 'Sản phẩm').substring(0, 20)}...) đã được đối soát thành công theo giá CSV. Tiền hoàn +${amountDisplay}đ.`
            ]
          );
        }

        updatedCount++;
      } else {
        // Insert new order
        const orderTime = formatToMySQLDateTime(purchaseTime);

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
                `Đơn hàng mới ${orderId} (${(productName || 'Sản phẩm').substring(0, 20)}...) đã được thêm và duyệt thành công. Tiền hoàn +${amountDisplay}đ đã được cộng.`
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
