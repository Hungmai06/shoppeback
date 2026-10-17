const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { getDatabase } = require('../config/db');
const { recalculateUserBalances } = require('../services/balanceService');
const { extractShopeeIds } = require('../services/shopeeService');

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
    .replace(/₫/g, 'd') // map ₫ to d so (₫) becomes (d) -> d
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese accents
    .replace(/[^a-z0-9]/g, ''); // keep only alphanumeric
}

// Helper to resolve SubID (like ADM002-cashback-web--CLK1789464623170, USR101, CLK1789464623170n1y1ho)
// to target UserId, ClickId, and PendingOrderId using token extraction, direct DB lookup, prefix/substring/timestamp matching
function resolveSubIdToUserId(cleanSubId, { userIds, userMap, affiliateSubIdToUserIdMap, clickSubIdToUserIdMap, orderLookupMap, allClickLogsFull, pendingOrders }) {
  if (!cleanSubId) return { targetUserId: null, targetClickId: null, pendingOrderId: null };

  const trimmed = cleanSubId.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  // Extract all sub tokens (delimited by -, _, |, /, :, space, commas)
  const rawTokens = trimmed.split(/[-_|\s/:,]+/).map(t => t.trim()).filter(Boolean);
  const candidateTokens = Array.from(new Set([trimmed, ...rawTokens]));

  // Also extract any CLK tracking token if embedded
  const clkMatches = trimmed.match(/clk[a-zA-Z0-9]+/gi);
  if (clkMatches) {
    for (const cm of clkMatches) {
      if (!candidateTokens.includes(cm)) candidateTokens.push(cm);
    }
  }

  // 1. Direct match with Orders table in system (order.id or order.click_id)
  if (orderLookupMap) {
    for (const token of candidateTokens) {
      const lTok = token.toLowerCase();
      if (orderLookupMap.has(lTok)) {
        const ord = orderLookupMap.get(lTok);
        if (ord && ord.user_id) {
          return {
            targetUserId: ord.user_id,
            targetClickId: ord.click_id || ord.id,
            pendingOrderId: ord.id
          };
        }
      }
    }
  }

  // 2. Direct match with click_logs or clickSubIdToUserIdMap
  if (clickSubIdToUserIdMap) {
    for (const token of candidateTokens) {
      const lTok = token.toLowerCase();
      if (clickSubIdToUserIdMap.has(lTok)) {
        return {
          targetUserId: clickSubIdToUserIdMap.get(lTok),
          targetClickId: token,
          pendingOrderId: null
        };
      }
    }
  }

  // 3. Direct match with Users (user.id or user.affiliate_sub_id)
  for (const token of candidateTokens) {
    const lTok = token.toLowerCase();
    if (userMap && userMap.has(lTok)) {
      return {
        targetUserId: userMap.get(lTok),
        targetClickId: null,
        pendingOrderId: null
      };
    }
    if (userIds) {
      for (const uid of userIds) {
        if (uid.toLowerCase() === lTok) {
          return {
            targetUserId: uid,
            targetClickId: null,
            pendingOrderId: null
          };
        }
      }
    }
    if (affiliateSubIdToUserIdMap && affiliateSubIdToUserIdMap.has(lTok)) {
      return {
        targetUserId: affiliateSubIdToUserIdMap.get(lTok),
        targetClickId: null,
        pendingOrderId: null
      };
    }
  }

  // 4. Extract base CLK pattern & timestamp digits (e.g., CLK1789464623170 from CLK1789464623170n1y1ho)
  const clkMatch = trimmed.match(/clk\d+/i);
  if (clkMatch) {
    const baseClk = clkMatch[0].toLowerCase();
    const digitsOnly = baseClk.replace(/[^0-9]/g, '');

    if (clickSubIdToUserIdMap) {
      for (const [key, userId] of clickSubIdToUserIdMap.entries()) {
        const lowerKey = key.toLowerCase();
        const keyDigits = lowerKey.replace(/[^0-9]/g, '');

        if (
          lowerKey === baseClk ||
          lowerKey.startsWith(baseClk) ||
          baseClk.startsWith(lowerKey) ||
          lowerTrimmed.includes(lowerKey) ||
          lowerKey.includes(lowerTrimmed) ||
          (digitsOnly.length >= 10 && keyDigits.length >= 10 && (digitsOnly.startsWith(keyDigits.substring(0, 10)) || keyDigits.startsWith(digitsOnly.substring(0, 10))))
        ) {
          return {
            targetUserId: userId,
            targetClickId: key,
            pendingOrderId: (orderLookupMap && orderLookupMap.has(lowerKey)) ? orderLookupMap.get(lowerKey).id : null
          };
        }
      }
    }

    // Timestamp proximity fallback (1789464623170 is Date.now() millisecond timestamp embedded in CLK)
    if (digitsOnly.length >= 12) {
      const tsNum = Number(digitsOnly.substring(0, 13));
      if (!isNaN(tsNum) && tsNum > 1500000000000 && tsNum < 2500000000000) {
        if (allClickLogsFull && allClickLogsFull.length > 0) {
          for (const log of allClickLogsFull) {
            if (!log.user_id) continue;
            const logTs = new Date(log.click_time || log.created_at || 0).getTime();
            if (!isNaN(logTs) && Math.abs(logTs - tsNum) <= 180000) {
              return {
                targetUserId: log.user_id,
                targetClickId: log.id || log.sub_id,
                pendingOrderId: null
              };
            }
          }
        }
        if (pendingOrders && pendingOrders.length > 0) {
          for (const pending of pendingOrders) {
            if (!pending.user_id) continue;
            const pTs = new Date(pending.created_at || 0).getTime();
            if (!isNaN(pTs) && Math.abs(pTs - tsNum) <= 180000) {
              return {
                targetUserId: pending.user_id,
                targetClickId: pending.click_id || pending.id,
                pendingOrderId: pending.id
              };
            }
          }
        }
      }
    }
  }

  // 5. Fallback prefix/substring scan against userIds & clickSubIdToUserIdMap
  if (userIds) {
    for (const uid of userIds) {
      if (uid && uid.length >= 4 && lowerTrimmed.includes(uid.toLowerCase())) {
        return {
          targetUserId: uid,
          targetClickId: null,
          pendingOrderId: null
        };
      }
    }
  }

  if (clickSubIdToUserIdMap) {
    for (const [key, userId] of clickSubIdToUserIdMap.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.length >= 6 && (lowerTrimmed.includes(lowerKey) || lowerKey.includes(lowerTrimmed))) {
        return {
          targetUserId: userId,
          targetClickId: key,
          pendingOrderId: (orderLookupMap && orderLookupMap.has(lowerKey)) ? orderLookupMap.get(lowerKey).id : null
        };
      }
    }
  }

  return { targetUserId: null, targetClickId: null, pendingOrderId: null };
}

// Helper to parse numbers from Shopee CSV format (e.g., "4673.385", "1892.23", "1.200.000₫", "25.000", "25,000", "1.200.000,50")
function parseShopeeNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  // Remove currency symbols (₫, đ), spaces, and quotes
  str = str.replace(/[₫đ\s"']/gi, '');

  // 1. Both dot and comma present (e.g. "1.200.000,50" or "1,200,000.50")
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Vietnamese format: dot is thousands, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: comma is thousands, dot is decimal
      str = str.replace(/,/g, '');
    }
  } 
  // 2. Multiple dots present (e.g. "1.200.000" or "4.673.385"): thousands separators
  else if ((str.match(/\./g) || []).length > 1) {
    str = str.replace(/\./g, '');
  } 
  // 3. Multiple commas present (e.g. "1,200,000"): thousands separators
  else if ((str.match(/,/g) || []).length > 1) {
    str = str.replace(/,/g, '');
  } 
  // 4. Single comma present (e.g. "4673,385" or "25,000")
  else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts[0].length > 3 || parts[1].length !== 3) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(',', '');
    }
  } 
  // 5. Single dot present (e.g. "4673.385", "1892.23", "626.5", "100.000")
  // In Shopee CSV/Excel, commission is exported with decimal point (e.g. 4673.385).
  // Left side has > 3 digits -> 100% decimal point!
  // Only if 1-3 digits followed by exactly '000' (e.g. "100.000" or "25.000") is it treated as thousands separator.
  else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts[0].length <= 3 && parts[1] === '000') {
      str = parts.join('');
    }
    // Otherwise keep dot as decimal point: 4673.385 -> 4673.385
  }

  const num = parseFloat(str.replace(/[^0-9.-]+/g, ''));
  return isNaN(num) ? 0 : num;
}

// Extract row fields using standard mapping for Shopee Affiliate CSV (all 47 official columns)
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
  // Official column: "ID đơn hàng" -> normKey = "iddonhang"
  for (const normKey of ['iddonhang', 'madonhang', 'madon', 'ordersn', 'orderid', 'checkoutid', 'id', 'sn', 'madinhdanh']) {
    if (normMap[normKey] && normMap[normKey].val) {
      orderId = normMap[normKey].val;
      break;
    }
  }
  if (!orderId) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('iddon') || nk.includes('madon') || nk.includes('ordersn') || nk.includes('orderid')) && entry.val) {
        orderId = entry.val;
        break;
      }
    }
  }

  // === SUB ID (User Identifier) ===
  // Collect from all official and custom sub columns: Sub_id1, Sub_id2, Sub_id3, Sub_id4, Sub_id5
  const subCandidateKeys = [
    'subid1', 'sub_id1', 'sub1',
    'subid2', 'sub_id2', 'sub2',
    'subid3', 'sub_id3', 'sub3',
    'subid4', 'sub_id4', 'sub4',
    'subid5', 'sub_id5', 'sub5',
    'subid', 'sub_id', 'sub'
  ];

  const foundSubParts = [];
  for (const k of subCandidateKeys) {
    if (normMap[k] && normMap[k].val) {
      const v = normMap[k].val.trim();
      if (v && v !== '-' && v.toLowerCase() !== 'null' && v.toLowerCase() !== 'undefined' && !foundSubParts.includes(v)) {
        foundSubParts.push(v);
      }
    }
  }

  // Also catch any other column with "subid" or "sub_id"
  if (foundSubParts.length === 0) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('subid') || nk.includes('sub_id')) && entry.val) {
        const v = entry.val.trim();
        if (v && v !== '-' && v.toLowerCase() !== 'null' && v.toLowerCase() !== 'undefined' && !foundSubParts.includes(v)) {
          foundSubParts.push(v);
        }
      }
    }
  }

  if (foundSubParts.length > 0) {
    // If multiple sub parts exist (e.g. Sub_id1 and Sub_id5), join them with "-" so parser can examine every part
    subId = foundSubParts.join('-');
  }

  // === SHOP ID, ITEM ID, SHOP NAME & MODEL ID ===
  // Official columns: "Shop id" -> normKey = "shopid", "Tên Cửa Hàng"/"Tên Shop" -> normKey = "tencuahang"/"tenshop"
  // "Item id" -> normKey = "itemid", "Tên Item"/"Tên sản phẩm" -> normKey = "tenitem"/"tensanpham", "ID Model" -> normKey = "idmodel"
  let shopId = '';
  let shopName = '';
  let itemId = '';
  let modelId = '';

  // 1. Shop ID
  for (const normKey of ['shopid', 'idshop', 'mashop', 'idcuahang', 'macuahang', 'cuahangid', 'sellerid', 'idseller']) {
    if (normMap[normKey] && normMap[normKey].val) {
      shopId = normMap[normKey].val;
      break;
    }
  }
  if (!shopId) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('shopid') || nk.includes('idshop') || nk.includes('cuahangid') || nk.includes('idcuahang')) && entry.val) {
        shopId = entry.val;
        break;
      }
    }
  }

  // 2. Shop Name (Tên Cửa Hàng / Tên Shop)
  for (const normKey of ['tencuahang', 'tenshop', 'shopname', 'cuahang', 'sellername', 'nameshop']) {
    if (normMap[normKey] && normMap[normKey].val) {
      shopName = normMap[normKey].val;
      break;
    }
  }
  if (!shopName) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('tencuahang') || nk.includes('tenshop') || nk.includes('shopname')) && entry.val) {
        shopName = entry.val;
        break;
      }
    }
  }

  // 3. ID Model
  for (const normKey of ['idmodel', 'modelid', 'mamodel', 'maphanloai', 'idphanloai']) {
    if (normMap[normKey] && normMap[normKey].val) {
      modelId = normMap[normKey].val;
      break;
    }
  }

  // 4. Item ID (Ưu tiên Item id chính thức)
  for (const normKey of ['itemid', 'iditem', 'masanpham', 'idsanpham', 'productid', 'idproduct', 'maitem']) {
    if (normMap[normKey] && normMap[normKey].val) {
      itemId = normMap[normKey].val;
      break;
    }
  }
  if (!itemId) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('itemid') || nk.includes('iditem') || nk.includes('masanpham')) && entry.val) {
        itemId = entry.val;
        break;
      }
    }
  }
  if (!itemId && modelId) {
    itemId = modelId;
  }

  // === PRODUCT NAME (Tên Item / Tên sản phẩm) ===
  for (const normKey of ['tenitem', 'tensanpham', 'tensp', 'itemname', 'productname', 'sanpham', 'item']) {
    if (normMap[normKey] && normMap[normKey].val) {
      productName = normMap[normKey].val;
      break;
    }
  }
  if (!productName) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('tenitem') || nk.includes('tensanpham') || nk.includes('tensp') || nk.includes('itemname') || nk.includes('productname') || nk.includes('sanpham')) && entry.val) {
        productName = entry.val;
        break;
      }
    }
  }
  if (!productName && shopName) {
    productName = shopName;
  }

  // === ORDER AMOUNT ===
  // Official columns: "Giá sau chiết khấu", "Doanh thu thuần", "Giá trị đơn hàng (₫)", "Giá(₫)"
  const amountCandidates = [
    'giasauchietkhau', 'doanhthuthuan', 'giatridonhangd', 'giatridonhang', 'giad', 'gia', 'giatrionhangd', 'giatrionhang',
    'giadonhang', 'giadon', 'giatri', 'tongtien', 'ordervalue', 'orderamount',
    'totalamount', 'amount', 'price'
  ];
  for (const normKey of amountCandidates) {
    if (normMap[normKey] && normMap[normKey].val) {
      const parsed = parseShopeeNumber(normMap[normKey].val);
      if (parsed > 0) {
        orderAmount = parsed;
        break;
      }
    }
  }
  if (!orderAmount) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('giatri') || nk.includes('giadon') || nk.includes('tongtien') || nk.includes('amount') || nk.includes('value')) && entry.val) {
        const parsed = parseShopeeNumber(entry.val);
        if (parsed > 0) { orderAmount = parsed; break; }
      }
    }
  }

  // === COMMISSION (Hoa hồng ròng tiếp thị liên kết / Tổng hoa hồng) ===
  const commCandidates = [
    'hoahongrongtipthilienketd',     // Hoa hồng ròng tiếp thị liên kết(₫)
    'hoahongrongtipthilienket',
    'hoahongrong',
    'tonghoahongdonhangd',            // Tổng hoa hồng đơn hàng(₫)
    'tonghoahongdonhang',
    'hoahongdonhangtushopeed',        // Hoa hồng đơn hàng từ Shopee(₫)
    'hoahongdonhangtushopee',
    'tonghoahongsanphamd',            // Tổng hoa hồng sản phẩm(₫)
    'tonghoahongsanpham',
    'tonghoahong',                    // Tổng hoa hồng
    'hoahongshopeetrensanphamd',     // Hoa hồng Shopee trên sản phẩm(₫)
    'hoahongshopeetrensanpham',
    'hoahongshopee',
    'hoahongshop',
    'hoahongtong',
    'hoahongsan',
    'hoahong',
    'commission',
    'comm'
  ];
  for (const normKey of commCandidates) {
    if (normMap[normKey] && normMap[normKey].val) {
      const parsed = parseShopeeNumber(normMap[normKey].val);
      if (parsed > 0) {
        // Bỏ phần thập phân của hoa hồng (ví dụ: 1892.23 thì bỏ 23 đi thành 1892)
        commission = Math.floor(parsed);
        break;
      }
    }
  }
  if (!commission) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('hoahong') || nk.includes('commission') || nk.includes('comm')) && entry.val) {
        const parsed = parseShopeeNumber(entry.val);
        if (parsed > 0) {
          commission = Math.floor(parsed);
          break;
        }
      }
    }
  }

  // === STATUS ===
  // Official columns: "Trạng thái đặt hàng" -> normKey = "trangthaidathang", "Trạng thái sản phẩm liên kết" -> normKey = "trangthaisanphamlienket"
  for (const normKey of ['trangthaidathang', 'trangthaidonhang', 'trangthaisanphamlienket', 'trangthainquoimua', 'trangthai', 'status']) {
    if (normMap[normKey] && normMap[normKey].val) {
      shopeeStatus = normMap[normKey].val;
      break;
    }
  }

  // === PURCHASE TIME & CLICK TIME ===
  // Official columns: "Thời Gian Đặt Hàng" -> normKey = "thoigiandathang", "Thời gian hoàn thành" -> normKey = "thoigianhoanthanh"
  for (const normKey of ['thoigiandathang', 'thoigianhoanthanh', 'thoigiantao', 'thoigiandat', 'ngaydathang', 'ngaydat', 'ngaytao', 'purchasetime', 'ordertime', 'createdat', 'date']) {
    if (normMap[normKey] && normMap[normKey].val) {
      purchaseTime = normMap[normKey].val;
      break;
    }
  }
  if (!purchaseTime) {
    for (const [nk, entry] of Object.entries(normMap)) {
      if ((nk.includes('thoigian') || nk.includes('ngay')) && !nk.includes('click') && entry.val) {
        purchaseTime = entry.val;
        break;
      }
    }
  }

  let clickTime = null;
  // Official column: "Thời gian Click" -> normKey = "thoigianclick"
  for (const normKey of ['thoigianclick', 'clicktime', 'thoidiemclick', 'ngayclick']) {
    if (normMap[normKey] && normMap[normKey].val) {
      clickTime = normMap[normKey].val;
      break;
    }
  }

  return {
    orderId,
    subId,
    productName,
    shopName,
    orderAmount,
    commission,
    shopeeStatus,
    purchaseTime,
    clickTime,
    shopId,
    itemId,
    modelId
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

// Helper to extract calendar date 'YYYY-MM-DD' from various string/date formats
function getCalendarDateStr(val) {
  if (!val) return null;
  const formatted = formatToMySQLDateTime(val);
  if (formatted && formatted.length >= 10) {
    return formatted.substring(0, 10); // 'YYYY-MM-DD'
  }
  return null;
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
 * Thuật toán quét đối soát thông minh & linh hoạt:
 * Khớp Đơn chờ CLK (hoặc đơn gán thủ công), Click log, và User theo:
 * 1. Khớp theo ID đơn / SubID trực tiếp
 * 2. Khớp thông minh theo Item ID, Shop ID, Tên sản phẩm, và Thời gian đặt (cùng ngày / trong 24h).
 */
function findSmartMatchedUser(purchaseTimeStr, productName, orderAmount, allClickLogsFull, pendingOrders, extraOptions = {}) {
  const {
    clickTimeStr,
    shopId,
    itemId,
    shopIds = [],
    itemIds = [],
    shopName,
    shopNames = [],
    productNames = [],
    targetUserId,
    orderId,
    cleanSubId,
    consumedOrderIds,
    orderLookupMap
  } = extraOptions;

  // Tập hợp danh sách Item IDs và Shop IDs từ file Excel
  const allItemIds = new Set((itemIds.length ? itemIds : (itemId ? [itemId] : [])).map(x => String(x).trim().toLowerCase()).filter(Boolean));
  const allShopIds = new Set((shopIds.length ? shopIds : (shopId ? [shopId] : [])).map(x => String(x).trim().toLowerCase()).filter(Boolean));

  // Direct match by ID / click_id in pendingOrders
  if (pendingOrders && pendingOrders.length > 0) {
    const targetOId = (orderId || '').toLowerCase();
    const targetSub = (cleanSubId || '').toLowerCase();
    const subClkMatch = targetSub.match(/clk\d+/i);
    const baseSubClk = subClkMatch ? subClkMatch[0].toLowerCase() : '';

    for (const pending of pendingOrders) {
      if (consumedOrderIds && consumedOrderIds.has((pending.id || '').toLowerCase())) continue;
      const pId = (pending.id || '').toLowerCase();
      const pClick = (pending.click_id || '').toLowerCase();

      if (targetOId && (pId === targetOId || pClick === targetOId)) {
        return {
          score: 200,
          userId: pending.user_id || targetUserId,
          clickId: pending.click_id || pending.id,
          pendingOrderId: pending.id,
          reason: `Khớp trực tiếp Mã đơn (${pending.id})`
        };
      }
      if (targetSub) {
        if (
          pId === targetSub || 
          pClick === targetSub || 
          (baseSubClk && (pId.startsWith(baseSubClk) || pClick.startsWith(baseSubClk) || baseSubClk.startsWith(pId) || baseSubClk.startsWith(pClick))) ||
          targetSub.startsWith(pId) || 
          targetSub.startsWith(pClick)
        ) {
          return {
            score: 200,
            userId: pending.user_id || targetUserId,
            clickId: pending.click_id || pending.id,
            pendingOrderId: pending.id,
            reason: `Khớp Mã Click/SubID (${pending.id})`
          };
        }
      }
    }
  }

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
  const csvDateStr = getCalendarDateStr(purchaseTimeStr) || getCalendarDateStr(clickTimeStr);
  const candidates = [];

  // Robust Product Matcher: BẮT BUỘC KHỚP SẢN PHẨM (Item ID / Mã model / Tên sản phẩm rõ ràng)
  // TUYỆT ĐỐI KHÔNG KHỚP NẾU CHỈ CÓ SHOP ID MÀ SẢN PHẨM KHÁC NHAU
  const isProductMatch = (excelName, targetUrlOrName, targetShopId = '', targetItemId = '') => {
    // 1. Direct Item ID match
    if (targetItemId && allItemIds.has(String(targetItemId).trim().toLowerCase())) {
      return { matched: true, matchType: 'itemId', matchedId: targetItemId, shopMatched: true };
    }

    let shopMatched = false;
    if (targetShopId && allShopIds.has(String(targetShopId).trim().toLowerCase())) {
      shopMatched = true;
    }

    const str1 = (excelName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const str2 = (targetUrlOrName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 2. Check if any itemId from Excel is present inside targetUrlOrName (dài >= 6 số)
    for (const itId of allItemIds) {
      if (itId.length >= 6 && (str2.includes(itId) || str1.includes(itId))) {
        return { matched: true, matchType: 'itemId', matchedId: itId, shopMatched };
      }
    }

    // 3. Check if any shopId from Excel is present inside targetUrlOrName
    for (const shId of allShopIds) {
      if (shId.length >= 5 && (str2.includes(shId) || str1.includes(shId))) {
        shopMatched = true;
        break;
      }
    }

    // 4. Tokenized Word Comparison (loại bỏ từ dừng, chỉ xét từ khóa đặc trưng)
    const words1 = str1.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    const words2 = str2.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    const stopWords = new Set([
      'shopee', 'mall', 'san', 'pham', 'chinh', 'hang', 'cao', 'cap', 'nam', 'nu',
      'shop', 'mua', 'ban', 'giam', 'gia', 'hot', 'combo', 'bo', 'set', 'moi',
      'dep', 'thoi', 'trang', 'tiet', 'kiem', 'uu', 'dai', 'freeship', 'do', 'cho',
      'chuan', 'xin', 'loai', 'mau', 'size', 'day', 'va', 'cua', 'tai', 'cac'
    ]);

    const keyWords1 = words1.filter(w => !stopWords.has(w));
    const keyWords2 = words2.filter(w => !stopWords.has(w));

    // Specific model code check (e.g. tx017, vachino, iphone15, xm4, s1 mini)
    for (const w1 of keyWords1) {
      if (w1.length >= 3 && (/\d/.test(w1) || w1.length >= 5)) {
        if (keyWords2.some(w2 => w2 === w1 || (w1.length >= 4 && (w2.includes(w1) || w1.includes(w2))))) {
          return { matched: true, matchType: 'modelCode', matchedCode: w1, shopMatched };
        }
      }
    }

    // Phải khớp ít nhất 2 từ khóa đặc trưng (chiều dài >= 3 ký tự)
    const matchedWords = [];
    for (const w1 of keyWords1) {
      if (w1.length >= 3 && keyWords2.some(w2 => w2 === w1 || (w1.length >= 5 && w2.includes(w1)))) {
        matchedWords.push(w1);
      }
    }

    if (matchedWords.length >= 2) {
      return { matched: true, matchType: 'nameWords', matchCount: matchedWords.length, matchedWords, shopMatched };
    }

    // Chuỗi con dài tối thiểu 12 ký tự không tính khoảng trắng
    const clean1 = str1.replace(/[^a-z0-9]/g, '');
    const clean2 = str2.replace(/[^a-z0-9]/g, '');
    if (clean1.length >= 12 && clean2.length >= 12) {
      if (clean1.includes(clean2) || clean2.includes(clean1)) {
        return { matched: true, matchType: 'nameSubstring', shopMatched };
      }
    }

    // KHÔNG BAO GIỜ KHỚP NẾU CHỈ CÓ SHOP ID HOẶC TỪ KHÓA CHUNG CHUNG
    return { matched: false };
  };

  // 1. Quét các đơn hàng pending trong CSDL
  if (pendingOrders && pendingOrders.length > 0) {
    for (const pending of pendingOrders) {
      if (consumedOrderIds && consumedOrderIds.has((pending.id || '').toLowerCase())) {
        continue;
      }

      if (targetUserId && pending.user_id && pending.user_id !== targetUserId) {
        continue;
      }

      // Trích xuất shopId & itemId của pending order nếu có
      let pShopId = pending.shop_id || '';
      let pItemId = pending.item_id || '';
      if (!pShopId || !pItemId) {
        const extracted = extractShopeeIds(pending.product_name || '');
        if (!pShopId && extracted.shopId) pShopId = extracted.shopId;
        if (!pItemId && extracted.itemId) pItemId = extracted.itemId;
      }

      const matchRes = isProductMatch(productName, pending.product_name, pShopId, pItemId);
      if (!matchRes.matched) continue;

      let score = 0;

      // 1. Điểm số sản phẩm
      if (matchRes.matchType === 'itemId') {
        score += 80; // Item ID là duy nhất trên Shopee
      } else if (matchRes.matchType === 'modelCode') {
        score += 60; // Trùng mã model sản phẩm
      } else if (matchRes.matchType === 'nameWords' && matchRes.matchCount >= 2) {
        score += 45; // Trùng nhiều từ khóa đặc trưng
      } else if (matchRes.matchType === 'nameSubstring') {
        score += 45;
      } else {
        continue; // Bỏ qua nếu không thỏa mãn sản phẩm
      }

      // 2. Điểm cộng khớp Shop ID
      const shopMatched = matchRes.shopMatched || (pShopId && allShopIds.has(String(pShopId).toLowerCase()));
      if (shopMatched) {
        score += 25;
      }

      // 3. Điểm cộng khớp người dùng
      if (targetUserId && pending.user_id && pending.user_id === targetUserId) {
        score += 30;
      }

      // 4. Khớp thời gian
      let isSameDay = false;
      let timeWithinWindow = false;
      const pendingDateStr = getCalendarDateStr(pending.created_at);

      if (csvDateStr && pendingDateStr && csvDateStr === pendingDateStr) {
        isSameDay = true;
        timeWithinWindow = true;
        score += 35; // Khớp cùng ngày lịch
      } else if (baseRefMs && pending.created_at) {
        const pendingMs = new Date(pending.created_at).getTime();
        if (!isNaN(pendingMs)) {
          const diffMs = Math.abs(baseRefMs - pendingMs);
          if (diffMs <= 86400000) { // trong vòng 24 giờ
            score += 25;
            timeWithinWindow = true;
          } else if (diffMs <= 172800000) { // trong vòng 48 giờ
            score += 10;
            timeWithinWindow = true;
          }
        }
      }

      // 5. Khớp giá tiền
      let priceMatched = false;
      if (orderAmount > 0 && pending.order_amount > 0) {
        const pDiff = Math.abs(orderAmount - pending.order_amount) / Math.max(orderAmount, pending.order_amount);
        if (pDiff <= 0.20) {
          score += 15;
          priceMatched = true;
        } else if (pDiff > 0.50 && matchRes.matchType !== 'itemId') {
          score -= 30; // Chênh lệch giá quá lớn trừ trường hợp trùng Item ID
        }
      }

      // BẮT BUỘC PHẢI THỎA MÃN ĐIỀU KIỆN THỜI GIAN & ĐỘ TIN CẬY
      if (!timeWithinWindow) continue;

      const isValid = (
        matchRes.matchType === 'itemId' ||
        (matchRes.matchType === 'modelCode' && isSameDay) ||
        (matchRes.matchType === 'nameWords' && isSameDay && (shopMatched || priceMatched))
      );

      if (!isValid || score < 95) continue;

      let matchReason = '';
      if (matchRes.matchType === 'itemId') {
        matchReason = `Khớp Đơn chờ (${pending.id}) theo Item ID (${matchRes.matchedId || pItemId})${isSameDay ? ' & Cùng ngày' : ''}`;
      } else if (matchRes.matchType === 'modelCode') {
        matchReason = `Khớp Đơn chờ (${pending.id}) theo Mã model (${matchRes.matchedCode}) & Cùng ngày`;
      } else {
        matchReason = `Khớp Đơn chờ (${pending.id}) theo Tên sản phẩm & CÙNG NGÀY (${pendingDateStr})`;
      }

      const pTimeMs = pending.created_at ? new Date(pending.created_at).getTime() : 0;
      candidates.push({
        score,
        userId: pending.user_id || targetUserId,
        clickId: pending.click_id || pending.id,
        pendingOrderId: pending.id,
        createdAtMs: pTimeMs,
        matchType: matchRes.matchType,
        isSameDay,
        shopMatched,
        priceMatched,
        reason: matchReason
      });
    }
  }

  // 2. Quét bảng click_logs và liên kết với Đơn chờ CLK trên web
  if (allClickLogsFull && allClickLogsFull.length > 0) {
    for (const log of allClickLogsFull) {
      if (!log.user_id) continue;
      if (targetUserId && log.user_id !== targetUserId) continue;

      // Tìm đơn chờ CLK tương ứng trên web
      let linkedPending = null;
      if (orderLookupMap) {
        if (log.id && orderLookupMap.has(log.id.toLowerCase())) {
          linkedPending = orderLookupMap.get(log.id.toLowerCase());
        } else if (log.sub_id && orderLookupMap.has(log.sub_id.toLowerCase())) {
          linkedPending = orderLookupMap.get(log.sub_id.toLowerCase());
        }
      }

      // Chỉ xét nếu lượt click này đã tạo ra Đơn chờ CLK trên web
      if (!linkedPending || !linkedPending.id) continue;
      if (consumedOrderIds && consumedOrderIds.has(linkedPending.id.toLowerCase())) continue;

      // Lấy Shop ID và Item ID từ click log nếu có
      let logShopId = log.shop_id || '';
      let logItemId = log.item_id || '';
      if (!logShopId || !logItemId) {
        const extracted = extractShopeeIds(log.product_url || '');
        if (!logShopId && extracted.shopId) logShopId = extracted.shopId;
        if (!logItemId && extracted.itemId) logItemId = extracted.itemId;
      }

      const matchRes = isProductMatch(productName, log.product_url, logShopId, logItemId) || isProductMatch(productName, linkedPending.product_name, linkedPending.shop_id || logShopId, linkedPending.item_id || logItemId);
      if (!matchRes.matched) continue;

      let score = 0;
      if (matchRes.matchType === 'itemId') {
        score += 80;
      } else if (matchRes.matchType === 'modelCode') {
        score += 60;
      } else if (matchRes.matchType === 'nameWords' && matchRes.matchCount >= 2) {
        score += 45;
      } else if (matchRes.matchType === 'nameSubstring') {
        score += 45;
      } else {
        continue;
      }

      const shopMatched = matchRes.shopMatched || (logShopId && allShopIds.has(String(logShopId).toLowerCase()));
      if (shopMatched) score += 25;

      if (targetUserId && (log.user_id === targetUserId || linkedPending.user_id === targetUserId)) {
        score += 30;
      }

      let isSameDay = false;
      let timeWithinWindow = false;
      const logDateStr = getCalendarDateStr(log.click_time || linkedPending.created_at);

      if (csvDateStr && logDateStr && csvDateStr === logDateStr) {
        isSameDay = true;
        timeWithinWindow = true;
        score += 35;
      } else if (baseRefMs) {
        const clickMs = new Date(log.click_time || linkedPending.created_at).getTime();
        if (!isNaN(clickMs)) {
          const diffMs = Math.abs(baseRefMs - clickMs);
          if (diffMs <= 86400000) {
            score += 25;
            timeWithinWindow = true;
          }
        }
      }

      if (!timeWithinWindow) continue;

      const isValid = (
        matchRes.matchType === 'itemId' ||
        (matchRes.matchType === 'modelCode' && isSameDay) ||
        (matchRes.matchType === 'nameWords' && isSameDay && shopMatched)
      );

      if (!isValid || score < 95) continue;

      let matchReason = '';
      if (matchRes.matchType === 'itemId') {
        matchReason = `Khớp Đơn chờ CLK (${linkedPending.id}) theo Item ID (${matchRes.matchedId || logItemId})${isSameDay ? ' & Cùng ngày' : ''}`;
      } else if (matchRes.matchType === 'modelCode') {
        matchReason = `Khớp Đơn chờ CLK (${linkedPending.id}) theo Mã model (${matchRes.matchedCode}) & Cùng ngày`;
      } else {
        matchReason = `Khớp Đơn chờ CLK (${linkedPending.id}) theo CÙNG NGÀY (${logDateStr}) & Tên sản phẩm`;
      }

      const cTimeMs = linkedPending.created_at ? new Date(linkedPending.created_at).getTime() : ((log.click_time) ? new Date(log.click_time).getTime() : 0);
      candidates.push({
        score,
        userId: linkedPending.user_id || log.user_id,
        clickId: log.id || linkedPending.click_id,
        pendingOrderId: linkedPending.id,
        createdAtMs: cTimeMs,
        matchType: matchRes.matchType,
        isSameDay,
        shopMatched,
        reason: matchReason
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // 1. Ưu tiên điểm số cao hơn
    if (Math.abs(b.score - a.score) >= 15) {
      return b.score - a.score;
    }
    // 2. Nếu cùng mức điểm, ưu tiên đơn muộn nhất (createdAtMs lớn nhất)
    const timeB = b.createdAtMs || 0;
    const timeA = a.createdAtMs || 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.score - a.score;
  });

  const best = candidates[0];

  // Khớp đạt từ 95 điểm trở lên VÀ BẮT BUỘC PHẢI CÓ ĐƠN CHỜ CLK TRÊN WEB
  if (best && best.score >= 95 && best.pendingOrderId) {
    return best;
  }

  return null;
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
        shopNames: fields.shopName ? [fields.shopName] : [],
        shopIds: fields.shopId ? [fields.shopId] : [],
        itemIds: fields.itemId ? [fields.itemId] : [],
        modelIds: fields.modelId ? [fields.modelId] : [],
        orderAmount: fields.orderAmount || 0,
        commission: fields.commission || 0,
        shopeeStatus: fields.shopeeStatus || '',
        purchaseTime: fields.purchaseTime,
        clickTime: fields.clickTime || null,
        shopId: fields.shopId || '',
        itemId: fields.itemId || '',
        modelId: fields.modelId || '',
        shopName: fields.shopName || ''
      });
    } else {
      const existing = grouped.get(lowerId);
      
      if (!existing.subId && fields.subId) {
        existing.subId = fields.subId;
      }
      if (fields.productName && !existing.productNames.includes(fields.productName)) {
        existing.productNames.push(fields.productName);
      }
      if (fields.shopName && !existing.shopNames.includes(fields.shopName)) {
        existing.shopNames.push(fields.shopName);
      }
      if (fields.shopId && !existing.shopIds.includes(fields.shopId)) {
        existing.shopIds.push(fields.shopId);
      }
      if (fields.itemId && !existing.itemIds.includes(fields.itemId)) {
        existing.itemIds.push(fields.itemId);
      }
      if (fields.modelId && !existing.modelIds.includes(fields.modelId)) {
        existing.modelIds.push(fields.modelId);
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
      if (!existing.shopName && fields.shopName) {
        existing.shopName = fields.shopName;
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
      shopName: item.shopNames.join(', ') || item.shopName || '',
      orderAmount: Math.floor(item.orderAmount),
      commission: Math.floor(item.commission),
      shopeeStatus: item.shopeeStatus,
      purchaseTime: item.purchaseTime,
      clickTime: item.clickTime,
      shopId: item.shopIds.join(', ') || item.shopId || '',
      itemId: item.itemIds.join(', ') || item.itemId || '',
      modelId: item.modelIds.join(', ') || item.modelId || '',
      shopIds: item.shopIds,
      itemIds: item.itemIds,
      productNames: item.productNames,
      shopNames: item.shopNames
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
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.isFile() && (now - stats.mtimeMs > 3600000)) { // 1 giờ
              fs.unlinkSync(filePath);
            }
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
    const userMap = new Map();
    const affiliateSubIdToUserIdMap = new Map();
    for (const u of allUsers) {
      if (u.id) userMap.set(u.id.toLowerCase(), u.id);
      if (u.affiliate_sub_id) affiliateSubIdToUserIdMap.set(u.affiliate_sub_id.toLowerCase(), u.id);
    }

    // Read all click_logs with click_time & product_url for exact & smart time-window matching
    const allClickLogsFull = await db.all('SELECT id, user_id, sub_id, product_url, click_time FROM click_logs WHERE user_id IS NOT NULL ORDER BY click_time DESC');
    const clickSubIdToUserIdMap = new Map();
    const orderLookupMap = new Map();

    for (const log of allClickLogsFull) {
      if (log.id && log.user_id) clickSubIdToUserIdMap.set(log.id.toLowerCase(), log.user_id);
      if (log.sub_id && log.user_id) clickSubIdToUserIdMap.set(log.sub_id.toLowerCase(), log.user_id);
    }

    // Read ALL orders that have user_id or are pending/CLK in the system (ưu tiên đơn mới/muộn nhất trước)
    const dbOrdersWithUser = await db.all("SELECT id, user_id, click_id, product_name, order_amount, status, created_at FROM orders WHERE user_id IS NOT NULL OR status = 'pending' OR id LIKE 'CLK%' ORDER BY created_at DESC");
    const pendingOrders = [];
    for (const p of dbOrdersWithUser) {
      if (p.id) {
        if (p.user_id) clickSubIdToUserIdMap.set(p.id.toLowerCase(), p.user_id);
        orderLookupMap.set(p.id.toLowerCase(), p);
      }
      if (p.click_id) {
        if (p.user_id) clickSubIdToUserIdMap.set(p.click_id.toLowerCase(), p.user_id);
        orderLookupMap.set(p.click_id.toLowerCase(), p);
      }
      if (p.status === 'pending' || (p.id && p.id.startsWith('CLK'))) {
        pendingOrders.push(p);
      }
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

    const rawRows = await readRowsFromFile(tempFilePath, req.file.originalname);

    report.totalRows = rawRows.length;
    const { orders: ordersToProcess, invalidCount } = groupRowsByOrderId(rawRows);
    report.invalidCount = invalidCount;

    // Sắp xếp các đơn trong file CSV theo thời gian mua muộn nhất trước
    ordersToProcess.sort((a, b) => {
      const tB = b.purchaseTime ? new Date(formatToMySQLDateTime(b.purchaseTime)).getTime() : 0;
      const tA = a.purchaseTime ? new Date(formatToMySQLDateTime(a.purchaseTime)).getTime() : 0;
      return tB - tA;
    });

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

    const consumedPendingOrderIds = new Set();

    for (const order of ordersToProcess) {
      const { orderId, subId, productName, orderAmount, commission, shopeeStatus, purchaseTime, clickTime, shopId, itemId } = order;

      // Clean SubID (sometimes sub_id contains spaces or @)
      const cleanSubId = subId ? subId.trim() : '';

      // Determine Status
      const mappedStatus = mapShopeeStatus(shopeeStatus);
      const userCashback = Math.floor((commission || 0) * cashbackRate);

      const lowerOrderId = orderId.toLowerCase();
      const exists = existingOrdersMap.has(lowerOrderId);
      const dbOrder = exists ? existingOrdersMap.get(lowerOrderId) : null;
      const currentDbStatus = dbOrder ? dbOrder.status : '';
      const currentDbUserId = dbOrder ? dbOrder.userId : '';

      let targetUserId = null;
      let targetClickId = null;
      let smartMatchInfo = null;

      if (cleanSubId) {
        const resolved = resolveSubIdToUserId(cleanSubId, {
          userIds,
          userMap,
          affiliateSubIdToUserIdMap,
          clickSubIdToUserIdMap,
          orderLookupMap,
          allClickLogsFull,
          pendingOrders
        });
        if (resolved.targetUserId) {
          targetUserId = resolved.targetUserId;
          targetClickId = resolved.targetClickId || null;
          if (resolved.pendingOrderId) {
            smartMatchInfo = {
              score: 100,
              userId: resolved.targetUserId,
              clickId: resolved.targetClickId,
              pendingOrderId: resolved.pendingOrderId,
              reason: `Khớp Đơn trong hệ thống (${resolved.pendingOrderId}) từ SubID`
            };
            consumedPendingOrderIds.add(resolved.pendingOrderId.toLowerCase());
          }
        }
      }

      if (!targetUserId && exists) {
        targetUserId = currentDbUserId || null;
      }

      // If not resolved from direct SubID order match, run smart matching (same day + product info)
      if (!smartMatchInfo) {
        smartMatchInfo = findSmartMatchedUser(purchaseTime, productName, orderAmount, allClickLogsFull, pendingOrders, { 
          clickTimeStr: clickTime, 
          shopId, 
          itemId, 
          shopIds: order.shopIds || (shopId ? [shopId] : []),
          itemIds: order.itemIds || (itemId ? [itemId] : []),
          shopName: order.shopName,
          shopNames: order.shopNames,
          productNames: order.productNames,
          targetUserId, 
          orderId, 
          cleanSubId,
          consumedOrderIds: consumedPendingOrderIds,
          orderLookupMap
        });

        if (smartMatchInfo) {
          if (!targetUserId && smartMatchInfo.userId) {
            targetUserId = smartMatchInfo.userId;
          }
          if (smartMatchInfo.pendingOrderId) {
            consumedPendingOrderIds.add(smartMatchInfo.pendingOrderId.toLowerCase());
          }
        }
      }

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
            shopId: order.shopId || '',
            itemId: order.itemId || '',
            shopName: order.shopName || '',
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
            shopId: order.shopId || '',
            itemId: order.itemId || '',
            shopName: order.shopName || '',
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
            shopId: order.shopId || '',
            itemId: order.itemId || '',
            shopName: order.shopName || '',
            amount: orderAmount,
            cashback: userCashback,
            subId: targetUserId,
            shopeeStatus: mappedStatus,
            status: 'matched',
            reason: changeReason || 'Cập nhật thông tin đơn hàng theo file CSV đối soát'
          });
        }
      } else {
        // Đơn hàng mới từ file CSV Shopee (chưa từng đối soát trước đó)
        // BẮT BUỘC PHẢI KHỚP VỚI MỘT ĐƠN ĐANG CHỜ TẠO BẰNG CLK TRÊN WEB
        const matchedPendingId = (smartMatchInfo && smartMatchInfo.pendingOrderId) ? smartMatchInfo.pendingOrderId : null;

        if (!matchedPendingId) {
          // BỎ QUA: Không có đơn chờ CLK nào trên web khớp với dòng này
          report.missingCount++;
          report.details.push({
            id: orderId,
            name: productName,
            shopId: order.shopId || '',
            itemId: order.itemId || '',
            shopName: order.shopName || '',
            amount: orderAmount,
            cashback: userCashback,
            subId: cleanSubId || targetUserId || '',
            shopeeStatus: mappedStatus,
            status: 'ignored',
            reason: 'Bỏ qua: Không tìm thấy đơn chờ CLK nào trên web khớp với đơn này (Chỉ đối soát các đơn có phát sinh CLK trên web)'
          });
          continue;
        }

        // Khớp thành công với đơn CLK đang chờ trên web
        report.matchedCount++;
        report.details.push({
          id: orderId,
          name: productName,
          shopId: order.shopId || '',
          itemId: order.itemId || '',
          shopName: order.shopName || '',
          amount: orderAmount,
          cashback: userCashback,
          subId: targetUserId || smartMatchInfo.userId || cleanSubId,
          shopeeStatus: mappedStatus,
          status: 'matched',
          reason: `Khớp & cập nhật Đơn chờ CLK trên web (${matchedPendingId}) -> ${orderId} cho User ${targetUserId || smartMatchInfo.userId || 'chưa gán'} (${smartMatchInfo.reason})`
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
    const userMap = new Map();
    const affiliateSubIdToUserIdMap = new Map();
    for (const u of allUsers) {
      if (u.id) userMap.set(u.id.toLowerCase(), u.id);
      if (u.affiliate_sub_id) affiliateSubIdToUserIdMap.set(u.affiliate_sub_id.toLowerCase(), u.id);
    }

    const allClickLogsFull = await db.all('SELECT id, user_id, sub_id, product_url, click_time FROM click_logs WHERE user_id IS NOT NULL ORDER BY click_time DESC');
    const clickSubIdToUserIdMap = new Map();
    const orderLookupMap = new Map();
    const clickIdMap = new Map();

    for (const log of allClickLogsFull) {
      if (log.id && log.user_id) {
        clickSubIdToUserIdMap.set(log.id.toLowerCase(), log.user_id);
        clickIdMap.set(log.id.toLowerCase(), log.id);
      }
      if (log.sub_id && log.user_id) {
        clickSubIdToUserIdMap.set(log.sub_id.toLowerCase(), log.user_id);
        clickIdMap.set(log.sub_id.toLowerCase(), log.id);
      }
    }

    const dbOrdersWithUser = await db.all("SELECT id, user_id, click_id, product_name, order_amount, status, created_at FROM orders WHERE user_id IS NOT NULL OR status = 'pending' OR id LIKE 'CLK%' ORDER BY created_at DESC");
    const pendingOrders = [];
    for (const p of dbOrdersWithUser) {
      if (p.id) {
        if (p.user_id) {
          clickSubIdToUserIdMap.set(p.id.toLowerCase(), p.user_id);
          clickIdMap.set(p.id.toLowerCase(), p.id);
        }
        orderLookupMap.set(p.id.toLowerCase(), p);
      }
      if (p.click_id) {
        if (p.user_id) {
          clickSubIdToUserIdMap.set(p.click_id.toLowerCase(), p.user_id);
          clickIdMap.set(p.click_id.toLowerCase(), p.id);
        }
        orderLookupMap.set(p.click_id.toLowerCase(), p);
      }
      if (p.status === 'pending' || (p.id && p.id.startsWith('CLK'))) {
        pendingOrders.push(p);
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

    const rawRows = await readRowsFromFile(tempFilePath, tempFileName);

    const { orders: ordersToProcess, invalidCount } = groupRowsByOrderId(rawRows);
    ignoredCount += invalidCount;

    // Sắp xếp các đơn trong file CSV theo thời gian mua muộn nhất trước
    ordersToProcess.sort((a, b) => {
      const tB = b.purchaseTime ? new Date(formatToMySQLDateTime(b.purchaseTime)).getTime() : 0;
      const tA = a.purchaseTime ? new Date(formatToMySQLDateTime(a.purchaseTime)).getTime() : 0;
      return tB - tA;
    });

    // Get system settings for cashback percentage calculation
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    // Begin transaction simulator
    await db.run('BEGIN TRANSACTION');

    const consumedPendingOrderIds = new Set();

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
      let resolvedPendingOrderId = null;
      let smartMatchInfo = null;

      if (cleanSubId) {
        const resolved = resolveSubIdToUserId(cleanSubId, {
          userIds,
          userMap,
          affiliateSubIdToUserIdMap,
          clickSubIdToUserIdMap,
          orderLookupMap,
          allClickLogsFull,
          pendingOrders
        });
        if (resolved.targetUserId) {
          targetUserId = resolved.targetUserId;
          targetClickId = resolved.targetClickId || null;
          if (resolved.pendingOrderId) {
            resolvedPendingOrderId = resolved.pendingOrderId;
            smartMatchInfo = {
              userId: resolved.targetUserId,
              clickId: resolved.targetClickId,
              pendingOrderId: resolved.pendingOrderId,
              reason: `Khớp Đơn trong hệ thống (${resolved.pendingOrderId}) từ SubID`
            };
            consumedPendingOrderIds.add(resolved.pendingOrderId.toLowerCase());
          }
        }
      }

      if (!targetUserId && exists) {
        targetUserId = currentDbUserId || null; // keep existing user
      }

      if (!smartMatchInfo) {
        smartMatchInfo = findSmartMatchedUser(purchaseTime, productName, orderAmount, allClickLogsFull, pendingOrders, { 
          clickTimeStr: clickTime, 
          shopId, 
          itemId, 
          shopIds: order.shopIds || (shopId ? [shopId] : []),
          itemIds: order.itemIds || (itemId ? [itemId] : []),
          shopName: order.shopName,
          shopNames: order.shopNames,
          productNames: order.productNames,
          targetUserId, 
          orderId, 
          cleanSubId,
          consumedOrderIds: consumedPendingOrderIds,
          orderLookupMap
        });

        if (smartMatchInfo) {
          if (!targetUserId && smartMatchInfo.userId) {
            targetUserId = smartMatchInfo.userId;
          }
          if (!targetClickId && smartMatchInfo.clickId) {
            targetClickId = smartMatchInfo.clickId;
          }
          if (smartMatchInfo.pendingOrderId) {
            resolvedPendingOrderId = smartMatchInfo.pendingOrderId;
            consumedPendingOrderIds.add(smartMatchInfo.pendingOrderId.toLowerCase());
          }
        }
      }

      const userCashback = Math.floor((commission || 0) * cashbackRate);

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

        // Always update order with exact CSV price, commission, cashback, product name, shopId and itemId
        await db.run(
          `UPDATE orders
           SET status = ?,
               user_id = ?,
               real_cashback = ?,
               estimated_cashback = ?,
               shopee_commission = ?,
               order_amount = ?,
               product_name = CASE WHEN ? != '' THEN ? ELSE product_name END,
               shop_id = CASE WHEN ? != '' THEN ? ELSE shop_id END,
               item_id = CASE WHEN ? != '' THEN ? ELSE item_id END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newStatus, newUserId, userCashback, userCashback, Math.floor(commission), Math.floor(orderAmount), productName, productName, shopId, shopId, itemId, itemId, dbOrder.id]
        );

        // Delete duplicate CLK pending order if smartMatch matched a different pending order ID
        if (smartMatchInfo && smartMatchInfo.pendingOrderId && smartMatchInfo.pendingOrderId.toLowerCase() !== lowerOrderId) {
          await db.run('DELETE FROM orders WHERE id = ?', [smartMatchInfo.pendingOrderId]);
        }

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
            const refBonus = Math.floor(oldCashback * 0.20);
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
              const refBonus = Math.floor(newCashback * 0.20);
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
        // Đơn hàng mới từ file CSV Shopee (chưa từng có trong hệ thống)
        // BẮT BUỘC PHẢI KHỚP VỚI MỘT ĐƠN ĐANG CHỜ TẠO BẰNG CLK TRÊN WEB
        const pendingIdToUpdate = resolvedPendingOrderId || ((smartMatchInfo && smartMatchInfo.pendingOrderId) ? smartMatchInfo.pendingOrderId : null);

        if (!pendingIdToUpdate) {
          // Không tìm thấy đơn chờ CLK tương ứng trên web -> BỎ QUA, TUYỆT ĐỐI KHÔNG TẠO ĐƠN MỚI
          ignoredCount++;
          continue;
        }

        const finalUserId = targetUserId || (smartMatchInfo && smartMatchInfo.userId) || null;

        await db.run(
          `UPDATE orders
           SET id = ?,
               click_id = COALESCE(click_id, ?),
               product_name = CASE WHEN ? != '' THEN ? ELSE product_name END,
               order_amount = CASE WHEN ? > 0 THEN ? ELSE order_amount END,
               shopee_commission = ?,
               estimated_cashback = ?,
               real_cashback = ?,
               status = ?,
               user_id = COALESCE(?, user_id),
               shop_id = CASE WHEN ? != '' THEN ? ELSE shop_id END,
               item_id = CASE WHEN ? != '' THEN ? ELSE item_id END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            orderId,
            pendingIdToUpdate,
            productName,
            productName,
            Math.floor(orderAmount),
            Math.floor(orderAmount),
            Math.floor(commission),
            userCashback,
            userCashback,
            mappedStatus,
            finalUserId,
            shopId,
            shopId,
            itemId,
            itemId,
            pendingIdToUpdate
          ]
        );

        // Calculate and add money to user if new order is already approved
        if (finalUserId && (mappedStatus === 'approved' || mappedStatus === 'paid')) {
          const finalCashback = userCashback;
          if (finalCashback > 0) {
            await db.run(
              `UPDATE users 
               SET balance = COALESCE(balance, 0) + ?,
                   total_cashback = COALESCE(total_cashback, 0) + ?
               WHERE id = ?`,
              [finalCashback, finalCashback, finalUserId]
            );

            // Check for referral bonus (20%)
            const targetUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [finalUserId]);
            if (targetUserObj && targetUserObj.referred_by) {
              const refBonus = Math.floor(finalCashback * 0.20);
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
                [refNotifId, targetUserObj.referred_by, `Bạn nhận được +${refBonus.toLocaleString('vi-VN')}đ hoa hồng từ giao dịch của người bạn giới thiệu.`]
              );
            }

            const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
            const amountDisplay = userCashback.toLocaleString('vi-VN');
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, ?, ?, 'order')`,
              [
                notifId,
                finalUserId,
                'Đơn hàng Shopee đã đối soát thành công',
                `Đơn hàng ${orderId} (${(productName || 'Sản phẩm').substring(0, 20)}...) khớp với đơn ${pendingIdToUpdate} trên web đã được duyệt. Tiền hoàn +${amountDisplay}đ đã được cộng.`
              ]
            );
          }
        }

        updatedCount++;
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

    // Tự động đồng bộ và tính lại toàn bộ số dư người dùng theo tất cả đơn hoàn thành và lịch sử rút tiền
    await recalculateUserBalances(db);

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
