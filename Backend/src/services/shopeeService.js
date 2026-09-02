const crypto = require('crypto');
const AFFILIATE_ID = process.env.SHOPEE_AFFILIATE_ID || '173401900099';

/**
 * Ensures the given ID is in UUID v4 format (8-4-4-4-12 hex).
 * If already UUID format, returns as is.
 * If non-UUID string (e.g. USR101), deterministically converts it into a UUID format string.
 * If empty, generates a new random UUID.
 *
 * @param {string} idInput
 * @returns {string} UUID string
 */
function ensureUuid(idInput) {
  if (!idInput) {
    return crypto.randomUUID();
  }

  const str = String(idInput).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(str)) {
    return str;
  }

  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Kiểm tra và validate URL có phải thuộc Shopee Việt Nam hay không
 * @param {string} inputUrl 
 * @returns {URL} parsed URL object
 */
function validateShopeeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('Thiếu URL Shopee');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(inputUrl.trim());
  } catch (err) {
    throw new Error('URL không hợp lệ');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const validDomains = ['shopee.vn', 'www.shopee.vn', 'vn.shp.ee', 's.shopee.vn'];

  const isValidShopee = validDomains.includes(hostname) || hostname.endsWith('.shopee.vn');
  if (!isValidShopee) {
    throw new Error('Chỉ hỗ trợ link Shopee Việt Nam');
  }

  return parsedUrl;
}

/**
 * Sinh mã tracking clickId độc nhất cho hệ thống
 * @returns {string}
 */
function generateClickId() {
  return 'CLK' + Date.now() + Math.random().toString(36).substring(2, 8);
}

/**
 * Chuẩn hóa URL sản phẩm Shopee thành dạng link gốc chuẩn https://shopee.vn/product/SHOP_ID/ITEM_ID
 * Giúp máy chủ Shopee an_redir dễ dàng nhận diện sản phẩm và redirect chính xác 100% về sản phẩm gốc
 */
function normalizeShopeeProductUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return inputUrl;

  let urlStr = inputUrl.trim();

  // Pattern 1: Hyphen placeholders /product/-/-.ITEM_ID -> convert to canonical itemId
  const matchHyphenPlaceholder = urlStr.match(/product\/-\/-\.(\d+)/);
  if (matchHyphenPlaceholder) {
    const itemId = matchHyphenPlaceholder[1];
    return `https://shopee.vn/product/0/${itemId}`;
  }

  // Pattern 2: i.SHOP_ID.ITEM_ID (Ví dụ: shopee.vn/ao-thun-i.123456.78910)
  const matchItemShop = urlStr.match(/i\.(\d+)\.(\d+)/);
  if (matchItemShop) {
    const shopId = matchItemShop[1];
    const itemId = matchItemShop[2];
    return `https://shopee.vn/product/${shopId}/${itemId}`;
  }

  // Pattern 3: product/SHOP_ID/ITEM_ID
  const matchProdPath = urlStr.match(/product\/(\d+)\/(\d+)/);
  if (matchProdPath) {
    const shopId = matchProdPath[1];
    const itemId = matchProdPath[2];
    return `https://shopee.vn/product/${shopId}/${itemId}`;
  }

  // Pattern 4: query parameters item_id & shop_id
  try {
    const parsed = new URL(urlStr);
    const itemId = parsed.searchParams.get('item_id') || parsed.searchParams.get('itemId');
    const shopId = parsed.searchParams.get('shop_id') || parsed.searchParams.get('shopId') || '0';
    if (itemId) {
      return `https://shopee.vn/product/${shopId}/${itemId}`;
    }
  } catch (e) {}

  return urlStr;
}

/**
 * Xử lý giải mã short link Shopee (vn.shp.ee, s.shopee.vn) thành URL sản phẩm gốc trước khi gửi cho an_redir
 */
async function resolveShopeeShortLink(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return inputUrl;

  const trimmed = inputUrl.trim();
  const lower = trimmed.toLowerCase();

  // Nếu là short link (vn.shp.ee, shope.ee, s.shopee.vn không chứa an_redir)
  if (lower.includes('vn.shp.ee') || lower.includes('shope.ee') || (lower.includes('s.shopee.vn') && !lower.includes('an_redir'))) {
    try {
      const response = await fetch(trimmed, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });

      if (response.url && response.url !== trimmed) {
        return normalizeShopeeProductUrl(response.url);
      }
    } catch (err) {
      console.warn('Resolve short link warning:', err.message);
    }
  }

  return normalizeShopeeProductUrl(trimmed);
}

/**
 * Tạo link Shopee Affiliate dạng deeplink từ CSDL hệ thống
 * Mở NGUYÊN VĂN link được cấu hình/lưu trong Admin System Settings (customBaseUrl) trước tiên
 * @param {string} originUrl - Link sản phẩm/trang Shopee gốc
 * @param {string} subId - Mã tracking sub_id của hệ thống (ví dụ clickId)
 * @returns {string} Link affiliate chuyển hướng
 */
function createShopeeAffiliateLink(originUrl, subId = '', customBaseUrl = '', customAffId = '') {
  validateShopeeUrl(originUrl);

  const affiliateId = customAffId || process.env.SHOPEE_AFFILIATE_ID || AFFILIATE_ID;

  // Lấy NGUYÊN VĂN link đã lưu trong cấu hình hệ thống Admin (shopee_cookie_url)
  let baseUrl = (customBaseUrl && customBaseUrl.trim()) ? customBaseUrl.trim() : 'https://s.shopee.vn/an_redir';

  // Chuẩn hóa link sản phẩm gốc
  const cleanOriginUrl = normalizeShopeeProductUrl(originUrl);

  const affiliateParams = new URLSearchParams();

  affiliateParams.set('origin_link', cleanOriginUrl);
  affiliateParams.set('affiliate_id', affiliateId);

  if (subId) {
    affiliateParams.set('sub_id', subId);
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${affiliateParams.toString()}`;
}

module.exports = {
  ensureUuid,
  validateShopeeUrl,
  generateClickId,
  normalizeShopeeProductUrl,
  resolveShopeeShortLink,
  createShopeeAffiliateLink,
  generateShopeeAffiliateLink: createShopeeAffiliateLink // alias for backwards compatibility
};
