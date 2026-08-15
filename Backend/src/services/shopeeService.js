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
 * Tạo link Shopee Affiliate dạng deeplink an_redir chuẩn
 * @param {string} originUrl - Link sản phẩm/trang Shopee gốc
 * @param {string} subId - Mã tracking sub_id của hệ thống (ví dụ clickId)
 * @returns {string} Link affiliate an_redir
 */
function createShopeeAffiliateLink(originUrl, subId = '') {
  validateShopeeUrl(originUrl);

  const affiliateId = process.env.SHOPEE_AFFILIATE_ID || AFFILIATE_ID;
  const affiliateParams = new URLSearchParams();

  affiliateParams.set('origin_link', originUrl.trim());
  affiliateParams.set('affiliate_id', affiliateId);

  if (subId) {
    affiliateParams.set('sub_id', subId);
  }

  return `https://s.shopee.vn/an_redir?${affiliateParams.toString()}`;
}

module.exports = {
  ensureUuid,
  validateShopeeUrl,
  generateClickId,
  createShopeeAffiliateLink,
  generateShopeeAffiliateLink: createShopeeAffiliateLink // alias for backwards compatibility
};
