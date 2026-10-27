/**
 * riohubService.js
 * Dịch vụ tích hợp TikTok Shop Affiliate API thông qua RioHub
 * 
 * Tài liệu & Quy chuẩn:
 * - Base URL ưu tiên: https://riohub.vn/api/v1
 * - Backup 1: https://riohub.riokupon.com/api/v1
 * - Backup 2: https://riohub.riokupon.me/api/v1
 * - Failover: CHỈ chuyển sang tên miền kế tiếp khi lỗi tầng kết nối (DNS, TLS cert, Timeout).
 * - Tên miền thành công được lưu lại (sticky) cho các request sau.
 * - Header xác thực: X-Riohub-Api-Key
 * - Cấu trúc sub_id: sub1-sub2-sub3-sub4 (tối đa 4 phần, phân tách bằng dấu '-')
 */

const crypto = require('crypto');
const { getDatabase } = require('../config/db');

// Danh sách tên miền RioHub theo thứ tự ưu tiên
const RIOHUB_DOMAINS = [
  'https://riohub.vn/api/v1',
  'https://riohub.riokupon.com/api/v1',
  'https://riohub.riokupon.me/api/v1'
];

// Lưu vị trí tên miền đang hoạt động tốt (Sticky domain)
let activeDomainIndex = 0;

// Cache sản phẩm 24h trong bộ nhớ (RioHub cache 24h)
const productInfoCache = new Map();
const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Kiểm tra xem lỗi có phải lỗi ở tầng kết nối/mạng/TLS hay không.
 * CHỈ chuyển domain khi xảy ra các lỗi này (cURL 6, 7, 28, 35, 51, 60).
 * Nếu nhận được HTTP Status 4xx/5xx thì KHÔNG failover vì request đã tới RioHub.
 */
function isConnectionLevelError(error) {
  if (!error) return false;

  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  const name = error.name || '';

  // 1. Lỗi DNS (cURL 6)
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || message.includes('getaddrinfo')) {
    return true;
  }

  // 2. Lỗi kết nối bị từ chối / đứt kết nối (cURL 7)
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE') {
    return true;
  }

  // 3. Lỗi Timeout (cURL 28)
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || name === 'AbortError' || message.includes('timeout')) {
    return true;
  }

  // 4. Lỗi bắt tay TLS / sai tên miền chứng chỉ SSL (cURL 35, 51, 60 - Bài học sự cố 29/09/2026)
  if (
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code.startsWith('ERR_SSL_') ||
    code.startsWith('SSL_') ||
    message.includes('certificate') ||
    message.includes('tls handshake') ||
    message.includes('cert_has_expired') ||
    message.includes('altname')
  ) {
    return true;
  }

  // 5. Fetch failed nguyên nhân do network không có response
  if (message.includes('fetch failed') && !error.status) {
    return true;
  }

  return false;
}

/**
 * Lấy RioHub API Key từ biến môi trường hoặc cấu hình hệ thống DB
 */
async function getRiohubApiKey() {
  try {
    const db = await getDatabase();
    const settings = await db.get('SELECT riohub_api_key FROM system_settings WHERE id = 1');
    if (settings && settings.riohub_api_key && settings.riohub_api_key.trim()) {
      return settings.riohub_api_key.trim();
    }
  } catch (err) {
    // Bỏ qua lỗi DB nếu chưa cập nhật cột
  }

  if (process.env.RIOHUB_API_KEY && process.env.RIOHUB_API_KEY.trim()) {
    return process.env.RIOHUB_API_KEY.trim();
  }

  return '';
}

async function getRiohubCreatorUsername() {
  let raw = '';
  try {
    const db = await getDatabase();
    const settings = await db.get('SELECT riohub_creator_username FROM system_settings WHERE id = 1');
    if (settings && settings.riohub_creator_username && settings.riohub_creator_username.trim()) {
      raw = settings.riohub_creator_username.trim();
    }
  } catch (err) {
    // Bỏ qua
  }

  if (!raw && process.env.RIOHUB_CREATOR_USERNAME && process.env.RIOHUB_CREATOR_USERNAME.trim()) {
    raw = process.env.RIOHUB_CREATOR_USERNAME.trim();
  }

  if (!raw) {
    raw = 'hungrevieweverything';
  }

  // Tự động gỡ ký tự '@' ở đầu nếu người dùng nhập @username
  return raw.replace(/^@/, '').trim();
}

/**
 * Thực hiện gọi request tới RioHub API kèm cơ chế tự động Failover giữa 3 tên miền
 * 
 * @param {string} endpoint Đường dẫn API bắt đầu bằng '/' (ví dụ: '/partner/tiktok/affiliate/links')
 * @param {object} options Các tùy chọn fetch (method, body, headers, timeout, ...)
 * @returns {Promise<any>}
 */
async function executeRiohubRequest(endpoint, options = {}) {
  const apiKey = (options.apiKey && options.apiKey.trim()) ? options.apiKey.trim() : (await getRiohubApiKey());
  if (!apiKey) {
    const missingKeyErr = new Error('Hệ thống chưa cấu hình RioHub API Key (vào Admin Cài đặt hoặc thêm RIOHUB_API_KEY)');
    missingKeyErr.status = 401;
    missingKeyErr.code = 'MISSING_API_KEY';
    throw missingKeyErr;
  }

  const method = options.method || 'GET';
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Riohub-Api-Key': apiKey,
    ...(options.headers || {})
  };

  const domainCount = RIOHUB_DOMAINS.length;
  let lastConnectionError = null;

  // Bắt đầu từ domain đang hoạt động tốt (activeDomainIndex)
  for (let attempt = 0; attempt < domainCount; attempt++) {
    const domainIdx = (activeDomainIndex + attempt) % domainCount;
    const baseDomain = RIOHUB_DOMAINS[domainIdx];
    const fullUrl = `${baseDomain}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    // Khởi tạo timeout 10 giây cho mỗi request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // ĐÃ NHẬN ĐƯỢC HTTP RESPONSE TỪ RIOHUB -> Lưu domain này làm domain mặc định
      if (domainIdx !== activeDomainIndex) {
        console.log(`[RioHub] Đã chuyển sang tên miền hoạt động ổn định: ${baseDomain}`);
        activeDomainIndex = domainIdx;
      }

      // Xử lý Rate Limit (429) theo tài liệu RioHub
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const err = new Error(`RioHub Rate Limit (300 req/phút): Vui lòng thử lại sau ${retryAfter ? retryAfter + ' giây' : 'ít phút'}`);
        err.status = 429;
        err.retryAfter = retryAfter;
        throw err;
      }

      const responseText = await response.text();
      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (jsonErr) {
        responseData = { raw: responseText };
      }

      // Nếu lỗi HTTP 4xx hoặc 5xx: KHÔNG đổi tên miền, trả lỗi trực tiếp
      if (!response.ok) {
        let errorMsg = '';
        if (typeof responseData?.message === 'string') {
          errorMsg = responseData.message;
        } else if (typeof responseData?.error === 'string') {
          errorMsg = responseData.error;
        } else if (responseData?.error && typeof responseData.error.message === 'string') {
          errorMsg = responseData.error.message;
        }

        if (!errorMsg) {
          if (response.status === 401) {
            errorMsg = 'API key sai hoặc thiếu (401 Unauthorized)';
          } else if (response.status === 403) {
            errorMsg = 'Creator không thuộc tài khoản của API key (403 Forbidden)';
          } else if (response.status === 404) {
            errorMsg = 'Creator chưa kết nối RioHub (404 Not Found)';
          } else if (response.status === 422) {
            errorMsg = 'Sản phẩm không có hoa hồng hoặc chưa được shop duyệt (422 product_not_promotable)';
          } else if (response.status === 502) {
            errorMsg = 'Không tạo được link nào (502 Bad Gateway)';
          } else {
            errorMsg = `RioHub API lỗi ${response.status}: ${response.statusText}`;
          }
        }
        const httpError = new Error(errorMsg);
        httpError.status = response.status;
        httpError.data = responseData;
        throw httpError;
      }

      return responseData;
    } catch (err) {
      clearTimeout(timeoutId);

      // Kiểm tra nếu là lỗi ở tầng kết nối/DNS/TLS/timeout -> Failover sang tên miền tiếp theo
      if (isConnectionLevelError(err)) {
        console.warn(`[RioHub Failover] Lỗi kết nối tới ${baseDomain}: ${err.message} (${err.code || err.name}). Đang chuyển sang tên miền dự phòng...`);
        lastConnectionError = err;
        continue; // Thử tên miền kế tiếp
      }

      // Nếu không phải lỗi kết nối (ví dụ lỗi HTTP 4xx/5xx ném ra ở trên) -> Ném lỗi ra ngoài ngay
      throw err;
    }
  }

  // Đã thử qua cả 3 tên miền mà đều lỗi kết nối
  const fatalError = new Error(`Không thể kết nối tới bất kỳ tên miền nào của RioHub (riohub.vn, riohub.riokupon.com, riohub.riokupon.me): ${lastConnectionError?.message}`);
  fatalError.status = 503;
  fatalError.code = 'ALL_DOMAINS_UNAVAILABLE';
  throw fatalError;
}

/**
 * Chuẩn hóa sub_id theo quy chuẩn RioHub:
 * Cấu trúc: sub1-sub2-sub3-sub4
 * Tối đa 4 phần, 1-128 ký tự [A-Za-z0-9_-], mỗi phần KHÔNG được chứa dấu '-' (dấu phân tách)
 * Vị trí trống để rỗng: abc-def--
 *
 * @param {object} param0
 * @param {string} param0.userId User ID (sẽ gán vào sub1)
 * @param {string} param0.clickId Click tracking ID (sẽ gán vào sub2)
 * @param {string} param0.source Nguồn/kênh (sẽ gán vào sub3, mặc định 'web')
 * @param {string} param0.extra Thông tin bổ sung (sub4)
 * @returns {string} sub_id đã chuẩn hóa
 */
function buildSubId({ userId = '', clickId = '', source = 'web', extra = '' } = {}) {
  // Thay thế dấu '-' trong từng thành phần thành '_' để không làm vỡ dấu phân tách
  const cleanPart = (val) => {
    if (!val) return '';
    return String(val)
      .trim()
      .replace(/-/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '')
      .substring(0, 30);
  };

  const s1 = cleanPart(userId);
  const s2 = cleanPart(clickId);
  const s3 = cleanPart(source);
  const s4 = cleanPart(extra);

  const combined = `${s1}-${s2}-${s3}-${s4}`.substring(0, 128);
  return combined;
}

/**
 * Giải mã sub_id ngược lại thành các thành phần
 * @param {string} subId
 * @returns {object} { sub1, sub2, sub3, sub4, userId, clickId, source }
 */
function parseSubId(subId) {
  if (!subId || typeof subId !== 'string') {
    return { sub1: '', sub2: '', sub3: '', sub4: '', userId: '', clickId: '', source: '' };
  }

  const parts = subId.split('-');
  const sub1 = parts[0] || '';
  const sub2 = parts[1] || '';
  const sub3 = parts[2] || '';
  const sub4 = parts[3] || '';

  return {
    sub1,
    sub2,
    sub3,
    sub4,
    userId: sub1,
    clickId: sub2,
    source: sub3
  };
}

/**
 * 1. Tạo link affiliate TikTok Shop (có gắn sub_id)
 * Endpoint: POST /partner/tiktok/affiliate/links
 * 
 * @param {object} params
 * @param {string} params.productUrl URL sản phẩm TikTok Shop (vt.tiktok.com/...)
 * @param {string} params.productId Mã sản phẩm TikTok Shop (nếu có)
 * @param {string} params.subId Chuỗi tracking sub_id
 * @param {string} params.creatorUsername Tên tài khoản creator (nếu bỏ trống sẽ lấy từ cài đặt hệ thống)
 * @returns {Promise<object>} { affiliate_link, sub_id, product_id, creator_username }
 */
async function createAffiliateLink({ productUrl, productId, subId, creatorUsername }) {
  const username = creatorUsername || (await getRiohubCreatorUsername());

  const body = {
    creator_username: username,
    sub_id: subId
  };

  if (productUrl) {
    body.product_url = productUrl.trim();
  }
  if (productId) {
    body.product_id = String(productId).trim();
  }

  if (!body.product_url && !body.product_id) {
    throw new Error('Cần cung cấp product_url hoặc product_id TikTok Shop');
  }

  const data = await executeRiohubRequest('/partner/tiktok/affiliate/links', {
    method: 'POST',
    body
  });

  return data;
}

/**
 * 1b. Tạo link affiliate TikTok Shop kèm thông tin sản phẩm (1 request duy nhất)
 * Endpoint: POST /partner/tiktok/affiliate/product-links
 * 
 * Phản hồi gồm:
 * - affiliate_link: URL link mua hàng affiliate có gắn sub_id
 * - sub_id, product_id, creator_username
 * - product: { id, title, main_image_url, commission: { rate, amount, currency }, original_price: { minimum_amount, maximum_amount, currency } }
 * - product_error: null hoặc thông tin lỗi nếu không lấy được thông tin sản phẩm
 * 
 * @param {object} params
 * @param {string} params.productUrl URL sản phẩm TikTok Shop (vt.tiktok.com/...)
 * @param {string} params.productId Mã sản phẩm TikTok Shop (nếu có)
 * @param {string} params.subId Chuỗi tracking sub_id
 * @param {string} params.creatorUsername Tên tài khoản creator
 * @param {string} [params.type] Loại link
 * @param {string} [params.channel] Kênh
 * @returns {Promise<object>}
 */
async function createAffiliateProductLink({ productUrl, productId, subId, creatorUsername, type, channel }) {
  const username = creatorUsername || (await getRiohubCreatorUsername());

  const body = {
    creator_username: username,
    sub_id: subId
  };

  if (productUrl) {
    body.product_url = productUrl.trim();
  }
  if (productId) {
    body.product_id = String(productId).trim();
  }
  if (type) body.type = type;
  if (channel) body.channel = channel;

  if (!body.product_url && !body.product_id) {
    throw new Error('Cần cung cấp product_url hoặc product_id TikTok Shop');
  }

  const data = await executeRiohubRequest('/partner/tiktok/affiliate/product-links', {
    method: 'POST',
    body
  });

  return data;
}

/**
 * 2. Deep link mở app TikTok Shop theo lô (Batch)
 * Endpoint: POST /partner/tiktok/affiliate/general-links
 * 
 * Lưu ý: Tối đa 50 product_ids/lần.
 * Deep link KHÔNG gắn được sub_id — cần track hoa hồng theo sub_id thì dùng createAffiliateLink.
 * 
 * @param {string[]} productIds Mảng danh sách tối đa 50 product_id
 * @returns {Promise<object>} { products: [...], failed: [...] }
 */
async function createGeneralLinks(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error('Danh sách product_ids không được rỗng');
  }

  const slicedIds = productIds.slice(0, 50).map(id => String(id).trim());

  const data = await executeRiohubRequest('/partner/tiktok/affiliate/general-links', {
    method: 'POST',
    body: {
      product_ids: slicedIds
    }
  });

  return data;
}

/**
 * 3. Lấy danh sách link đã tạo qua RioHub
 * Endpoint: GET /partner/tiktok/affiliate/links
 * 
 * @param {object} filters Bộ lọc: sub_id, sub1..sub4, channel, date_start, date_end, page, page_size
 * @returns {Promise<object>}
 */
async function getAffiliateLinks(filters = {}) {
  const query = new URLSearchParams();
  const username = filters.creator_username || (await getRiohubCreatorUsername());
  if (username) query.append('creator_username', username);

  if (filters.sub_id) query.append('sub_id', filters.sub_id);
  if (filters.sub1) query.append('sub1', filters.sub1);
  if (filters.sub2) query.append('sub2', filters.sub2);
  if (filters.sub3) query.append('sub3', filters.sub3);
  if (filters.sub4) query.append('sub4', filters.sub4);
  if (filters.channel) query.append('channel', filters.channel);
  if (filters.date_start) query.append('date_start', filters.date_start);
  if (filters.date_end) query.append('date_end', filters.date_end);
  if (filters.page) query.append('page', String(filters.page));
  if (filters.page_size) query.append('page_size', String(Math.min(200, filters.page_size)));

  const qs = query.toString();
  const endpoint = `/partner/tiktok/affiliate/links${qs ? `?${qs}` : ''}`;

  return await executeRiohubRequest(endpoint, { method: 'GET' });
}

/**
 * 4. Lấy danh sách đơn hàng affiliate từ RioHub
 * Endpoint: GET /partner/tiktok/affiliate/orders
 * 
 * Query params (theo tài liệu chuẩn RioHub):
 * - creator_username: (Bắt buộc) Creator thuộc tài khoản
 * - time_start: Unix giây hoặc Y-m-d H:i:s — lọc theo ngày tạo (từ)
 * - time_end: Unix giây hoặc Y-m-d H:i:s — lọc theo ngày tạo (đến, không bao gồm)
 * - update_time_start: Unix giây — lọc theo thời điểm đơn cập nhật (từ) (sync tăng dần)
 * - update_time_end: Unix giây — lọc theo ngày cập nhật (đến, không bao gồm)
 * - order_id: 1 mã đơn hoặc danh sách ngăn cách dấu phẩy (tối đa 200)
 * - product_id: 1 hoặc list (tối đa 100) — lọc theo sản phẩm
 * - status: 1=pending · 2=settled · 3=cancelled/refunded
 * - settlement_status: SETTLED, AWAITING PAYMENT (passthrough TikTok)
 * - content_type: VIDEO / LIVE / SHOWCASE / LINKSHARE
 * - fully_refunded: 0 | 1 — lọc đơn hoàn toàn bộ
 * - sub_id: Khớp chuỗi con trên tag
 * - sub1..sub4: Khớp chính xác từng vị trí của tag
 * - trace_id: Mã click (1 mã hoặc list phân tách dấu phẩy, tối đa 200)
 * - page / page_size: Phân trang (mặc định 1 / 50, tối đa 200)
 * 
 * @param {object} filters Bộ lọc
 * @returns {Promise<object>}
 */
async function getAffiliateOrders(filters = {}) {
  const query = new URLSearchParams();
  const username = (filters.creator_username && String(filters.creator_username).trim())
    || (await getRiohubCreatorUsername());
  if (username) query.append('creator_username', username.trim());

  // Lọc theo ngày tạo (hỗ trợ cả time_start và create_time_start)
  const timeStart = filters.time_start || filters.create_time_start;
  if (timeStart) query.append('time_start', String(timeStart).trim());

  const timeEnd = filters.time_end || filters.create_time_end;
  if (timeEnd) query.append('time_end', String(timeEnd).trim());

  // Lọc theo ngày cập nhật (update_time_start / update_time_end)
  if (filters.update_time_start) query.append('update_time_start', String(filters.update_time_start).trim());
  if (filters.update_time_end) query.append('update_time_end', String(filters.update_time_end).trim());

  // Lọc theo mã đơn hàng (order_id)
  const orderId = filters.order_id || filters.order_ids;
  if (orderId) {
    const ids = Array.isArray(orderId) ? orderId.join(',') : String(orderId).trim();
    if (ids) query.append('order_id', ids);
  }

  // Lọc theo mã sản phẩm (product_id)
  if (filters.product_id) {
    const pids = Array.isArray(filters.product_id) ? filters.product_id.join(',') : String(filters.product_id).trim();
    if (pids) query.append('product_id', pids);
  }

  // Lọc theo trạng thái đơn (1=pending, 2=settled, 3=cancelled/refunded)
  if (filters.status !== undefined && filters.status !== '' && filters.status !== null) {
    query.append('status', String(filters.status).trim());
  }

  // Lọc theo trạng thái đối soát TikTok (SETTLED, AWAITING PAYMENT, v.v.)
  if (filters.settlement_status && String(filters.settlement_status).trim()) {
    query.append('settlement_status', String(filters.settlement_status).trim());
  }

  // Lọc theo loại nội dung (VIDEO / LIVE / SHOWCASE / LINKSHARE)
  if (filters.content_type && String(filters.content_type).trim()) {
    query.append('content_type', String(filters.content_type).trim());
  }

  // Lọc theo fully_refunded (0 | 1)
  if (filters.fully_refunded !== undefined && filters.fully_refunded !== '' && filters.fully_refunded !== null) {
    query.append('fully_refunded', String(filters.fully_refunded).trim());
  }

  // Tag và Sub IDs
  if (filters.sub_id && String(filters.sub_id).trim()) query.append('sub_id', String(filters.sub_id).trim());
  if (filters.sub1 && String(filters.sub1).trim()) query.append('sub1', String(filters.sub1).trim());
  if (filters.sub2 && String(filters.sub2).trim()) query.append('sub2', String(filters.sub2).trim());
  if (filters.sub3 && String(filters.sub3).trim()) query.append('sub3', String(filters.sub3).trim());
  if (filters.sub4 && String(filters.sub4).trim()) query.append('sub4', String(filters.sub4).trim());

  // Click tracking / Trace ID
  if (filters.trace_id) {
    const tids = Array.isArray(filters.trace_id) ? filters.trace_id.join(',') : String(filters.trace_id).trim();
    if (tids) query.append('trace_id', tids);
  }

  // Phân trang
  if (filters.page) query.append('page', String(filters.page).trim());
  if (filters.page_size) {
    const pageSize = Math.min(200, Math.max(1, parseInt(filters.page_size, 10) || 50));
    query.append('page_size', String(pageSize));
  } else {
    query.append('page_size', '50');
  }

  const qs = query.toString();
  const endpoint = `/partner/tiktok/affiliate/orders${qs ? `?${qs}` : ''}`;

  return await executeRiohubRequest(endpoint, { method: 'GET' });
}

/**
 * 5. Lấy thông tin sản phẩm và hoa hồng TikTok Shop
 * Endpoint: GET /partner/tiktok/affiliate/products
 * 
 * Query params (theo tài liệu RioHub):
 * - creator_username: Username TikTok creator (đã kết nối) (BẮT BUỘC)
 * - product_id: 1 id hoặc danh sách phân tách dấu phẩy, tối đa 100 (BẮT BUỘC)
 * 
 * Có tích hợp bộ nhớ cache 24h
 * 
 * @param {string[]} productIds Mảng tối đa 100 mã sản phẩm
 * @param {string} creatorUsername Tên creator (nếu bỏ trống sẽ lấy từ cài đặt hệ thống)
 * @returns {Promise<object>} { creator_username, requested, found, products, not_found }
 */
async function getProductInfo(productIds = [], creatorUsername = '') {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { products: [], not_found: [] };
  }

  const username = creatorUsername || (await getRiohubCreatorUsername());

  const idsToFetch = [];
  const cachedResults = [];
  const now = Date.now();

  for (const id of productIds) {
    const cleanId = String(id).trim();
    if (productInfoCache.has(cleanId)) {
      const entry = productInfoCache.get(cleanId);
      if (now - entry.timestamp < PRODUCT_CACHE_TTL_MS) {
        cachedResults.push(entry.data);
        continue;
      }
    }
    idsToFetch.push(cleanId);
  }

  if (idsToFetch.length === 0) {
    return {
      creator_username: username,
      requested: productIds.length,
      found: cachedResults.length,
      products: cachedResults,
      not_found: []
    };
  }

  const slicedIds = idsToFetch.slice(0, 100);
  const query = new URLSearchParams();
  if (username) {
    query.append('creator_username', username);
  }
  // RioHub query param: product_id (chuỗi phân tách dấu phẩy)
  query.append('product_id', slicedIds.join(','));

  const endpoint = `/partner/tiktok/affiliate/products?${query.toString()}`;

  try {
    const resData = await executeRiohubRequest(endpoint, { method: 'GET' });
    const fetchedProducts = resData?.products || [];

    // Lưu vào cache 24h
    for (const prod of fetchedProducts) {
      const pid = String(prod.id || prod.product_id || '').trim();
      if (pid) {
        productInfoCache.set(pid, {
          timestamp: Date.now(),
          data: prod
        });
      }
    }

    return {
      creator_username: resData?.creator_username || username,
      requested: resData?.requested || productIds.length,
      found: resData?.found || (cachedResults.length + fetchedProducts.length),
      products: [...cachedResults, ...fetchedProducts],
      not_found: resData?.not_found || []
    };
  } catch (err) {
    // Nếu có cache trước đó, trả về cache
    if (cachedResults.length > 0) {
      return {
        creator_username: username,
        requested: productIds.length,
        found: cachedResults.length,
        products: cachedResults,
        not_found: []
      };
    }
    throw err;
  }
}

/**
 * Xác thực chữ ký Webhook từ RioHub qua header X-Riohub-Signature
 * 
 * @param {string} rawBody Nội dung thô của request body
 * @param {string} signature Header X-Riohub-Signature
 * @param {string} secret Khóa bí mật webhook
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature) return false;
  if (!secret) return true; // Nếu chưa cài secret thì chấp nhận request

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (err) {
    return false;
  }
}

module.exports = {
  RIOHUB_DOMAINS,
  isConnectionLevelError,
  executeRiohubRequest,
  buildSubId,
  parseSubId,
  createAffiliateLink,
  createAffiliateProductLink,
  createGeneralLinks,
  getAffiliateLinks,
  getAffiliateOrders,
  getProductInfo,
  verifyWebhookSignature,
  getRiohubApiKey,
  getRiohubCreatorUsername
};
