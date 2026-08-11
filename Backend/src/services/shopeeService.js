const crypto = require('crypto');

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

  // Deterministically generate standard UUID layout from MD5 hash
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Generates a Shopee Affiliate Link with encoded originUrl, SHOPEE_AFFILIATE_ID, and sub_id (UUID format).
 *
 * @param {string} originUrl - Original Shopee product or page URL
 * @param {object|string} user - User object containing affiliate_sub_id or id, or user ID string
 * @returns {string} Generated Shopee affiliate link
 */
function generateShopeeAffiliateLink(originUrl, user) {
  if (!originUrl) {
    throw new Error('originUrl là bắt buộc');
  }

  const SHOPEE_AFFILIATE_ID = process.env.SHOPEE_AFFILIATE_ID;
  if (!SHOPEE_AFFILIATE_ID) {
    throw new Error('SHOPEE_AFFILIATE_ID chưa được cấu hình trong biến môi trường (environment variable)');
  }

  const encodedOrigin = encodeURIComponent(originUrl);

  // Extract affiliate_sub_id or id from user parameter
  let rawSubId;
  if (typeof user === 'object' && user !== null) {
    rawSubId = user.affiliate_sub_id || user.id;
  } else {
    rawSubId = user;
  }

  const subId = ensureUuid(rawSubId);

  const affiliateLink =
    `https://s.shopee.vn/an_redir` +
    `?origin_link=${encodedOrigin}` +
    `&affiliate_id=${SHOPEE_AFFILIATE_ID}` +
    `&sub_id=${subId}`;

  return affiliateLink;
}

module.exports = {
  generateShopeeAffiliateLink,
  ensureUuid
};
