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
 * Nhận diện domain và mã quốc gia từ URL Shopee
 */
function detectShopeeDomainAndCountry(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return { domain: 'shopee.vn', country: 'VN' };
  try {
    const raw = inputUrl.trim();
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('.co.id')) return { domain: 'shopee.co.id', country: 'ID' };
    if (host.includes('.co.th')) return { domain: 'shopee.co.th', country: 'TH' };
    if (host.includes('.com.my')) return { domain: 'shopee.com.my', country: 'MY' };
    if (host.includes('.ph')) return { domain: 'shopee.ph', country: 'PH' };
    if (host.includes('.sg')) return { domain: 'shopee.sg', country: 'SG' };
    if (host.includes('.tw')) return { domain: 'shopee.tw', country: 'TW' };
    if (host.includes('.com.br')) return { domain: 'shopee.com.br', country: 'BR' };
    if (host.includes('.com.mx')) return { domain: 'shopee.com.mx', country: 'MX' };
    if (host.includes('.cl')) return { domain: 'shopee.cl', country: 'CL' };
    if (host.includes('.com.co')) return { domain: 'shopee.com.co', country: 'CO' };
  } catch (e) {}
  return { domain: 'shopee.vn', country: 'VN' };
}

/**
 * Chuẩn hóa URL sản phẩm Shopee thành Landing page sạch chuẩn 2026:
 * Dạng: https://shopee.<domain>/product/<shop_id>/<item_id> hoặc https://shopee.<domain>/<slug>-i.<shop_id>.<item_id>
 * Loại bỏ 100% utm_*, gads_*, sp_atk, affiliate tracking cũ hay tham số quảng cáo.
 */
function normalizeShopeeProductUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return inputUrl;

  let urlStr = inputUrl.trim();
  const { domain } = detectShopeeDomainAndCountry(urlStr);

  // Pattern 1: Hyphen placeholders /product/-/-.ITEM_ID -> convert to canonical itemId
  const matchHyphenPlaceholder = urlStr.match(/product\/-\/-\.(\d+)/);
  if (matchHyphenPlaceholder) {
    const itemId = matchHyphenPlaceholder[1];
    return `https://${domain}/product/0/${itemId}`;
  }

  // Pattern 2: slug-i.SHOP_ID.ITEM_ID (Ví dụ: shopee.vn/ao-thun-i.123456.78910)
  const matchSlugItemShop = urlStr.match(/([a-zA-Z0-9_-]+)-i\.(\d+)\.(\d+)/);
  if (matchSlugItemShop) {
    const slug = matchSlugItemShop[1];
    const shopId = matchSlugItemShop[2];
    const itemId = matchSlugItemShop[3];
    return `https://${domain}/${slug}-i.${shopId}.${itemId}`;
  }

  // Pattern 3: i.SHOP_ID.ITEM_ID (Không slug)
  const matchItemShop = urlStr.match(/i\.(\d+)\.(\d+)/);
  if (matchItemShop) {
    const shopId = matchItemShop[1];
    const itemId = matchItemShop[2];
    return `https://${domain}/product/${shopId}/${itemId}`;
  }

  // Pattern 4: product/SHOP_ID/ITEM_ID
  const matchProdPath = urlStr.match(/product\/(\d+)\/(\d+)/);
  if (matchProdPath) {
    const shopId = matchProdPath[1];
    const itemId = matchProdPath[2];
    return `https://${domain}/product/${shopId}/${itemId}`;
  }

  // Pattern 5: query parameters item_id & shop_id
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    const itemId = parsed.searchParams.get('item_id') || parsed.searchParams.get('itemId');
    const shopId = parsed.searchParams.get('shop_id') || parsed.searchParams.get('shopId') || '0';
    if (itemId) {
      return `https://${domain}/product/${shopId}/${itemId}`;
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

const SHOPEE_AN_REDIR_DOMAINS = {
  VN: 'https://s.shopee.vn/an_redir',
  ID: 'https://s.shopee.co.id/an_redir',
  TH: 'https://s.shopee.co.th/an_redir',
  MY: 'https://s.shopee.com.my/an_redir',
  PH: 'https://s.shopee.ph/an_redir',
  SG: 'https://s.shopee.sg/an_redir',
  TW: 'https://s.shopee.tw/an_redir',
  BR: 'https://s.shopee.com.br/an_redir',
  MX: 'https://s.shopee.com.mx/an_redir',
  CL: 'https://s.shopee.cl/an_redir',
  CO: 'https://s.shopee.com.co/an_redir'
};

/**
 * Chuẩn hóa sub_id tối đa 5 vị trí theo chuẩn 2026:
 * sub1 = Publisher/KOL
 * sub2 = Campaign
 * sub3 = Source (fb, tiktok, web…)
 * sub4 = Post/Video ID
 * sub5 = Custom/Remark (hoặc clickId)
 * Quy tắc: Mỗi sub không được chứa "-" bên trong (tự động đổi thành "_").
 * Thiếu vị trí nào để trống nhưng giữ đúng thứ tự.
 * @param {string|Object|Array} subInput
 * @returns {string} sub_id chuẩn định dạng (VD: kolA-summer26-fb-post123-note)
 */
function formatStandardSubId(subInput) {
  if (!subInput) return '';

  const cleanPart = (val) => {
    if (val === undefined || val === null) return '';
    return String(val).trim().replace(/\s+/g, '_').replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  };

  let parts = [];

  if (typeof subInput === 'object' && !Array.isArray(subInput)) {
    parts = [
      cleanPart(subInput.sub1 ?? subInput.publisher),
      cleanPart(subInput.sub2 ?? subInput.campaign),
      cleanPart(subInput.sub3 ?? subInput.source),
      cleanPart(subInput.sub4 ?? subInput.postId),
      cleanPart(subInput.sub5 ?? subInput.remark ?? subInput.clickId)
    ];
  } else if (Array.isArray(subInput)) {
    parts = subInput.slice(0, 5).map(cleanPart);
  } else if (typeof subInput === 'string') {
    const rawParts = subInput.split('-');
    if (rawParts.length > 1 && rawParts.length <= 5) {
      parts = rawParts.map(p => p.trim());
    } else {
      parts = [cleanPart(subInput)];
    }
  }

  // Cắt bỏ các dấu "-" trống ở đuôi
  let lastNonEmpty = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty === -1) return '';
  return parts.slice(0, lastNonEmpty + 1).join('-');
}

/**
 * Quy trình 4 bước tạo link Sàn Cam Affiliate chuẩn 2026 (cơ chế an_redir)
 * Bước 1: Landing page sạch (https://shopee.vn/product/<shop_id>/<item_id> hoặc <slug>-i.<shop_id>.<item_id>)
 * Bước 2: Encode toàn bộ landing page bằng URL encoding (encodeURIComponent)
 * Bước 3: Ghép tham số vào domain an_redir theo quốc gia
 * Bước 4: Chuẩn hóa sub_id tối đa 5 vị trí (sub1-sub2-sub3-sub4-sub5)
 *
 * @param {Object} options
 * @param {string} options.originUrl - Link sản phẩm gốc
 * @param {string} [options.affiliateId] - Shopee Affiliate ID
 * @param {string|Object|Array} [options.subParams] - Cấu trúc sub_id 5 vị trí
 * @param {string} [options.country='VN'] - Mã quốc gia (VN, TH, ID, MY, PH, SG, TW, BR, MX, CL, CO)
 * @param {string} [options.customBaseUrl] - URL an_redir tùy biến nếu có
 * @returns {{ finalUrl: string, cleanLanding: string, encodedLanding: string, affiliateId: string, subId: string, domainUrl: string }}
 */
function buildShopeeAnRedirLink({ originUrl, affiliateId, subParams = '', country = 'VN', customBaseUrl = '' }) {
  if (!originUrl) {
    throw new Error('Thiếu link sản phẩm Shopee gốc (originUrl)');
  }

  const affId = affiliateId || process.env.SHOPEE_AFFILIATE_ID || AFFILIATE_ID;
  if (!affId) {
    throw new Error('Thiếu affiliate_id. Không thể ghi nhận hoa hồng');
  }

  // Bước 1: Landing page sạch
  const cleanLanding = normalizeShopeeProductUrl(originUrl);

  // Xác định domain chuẩn theo quốc gia (Bắt buộc chứa an_redir)
  const detected = detectShopeeDomainAndCountry(cleanLanding);
  const cKey = (country && country !== 'VN' ? country : (detected.country || 'VN')).toUpperCase();
  const domainUrl = (customBaseUrl && customBaseUrl.trim() && customBaseUrl.includes('an_redir'))
    ? customBaseUrl.trim()
    : (SHOPEE_AN_REDIR_DOMAINS[cKey] || SHOPEE_AN_REDIR_DOMAINS.VN);

  // Bước 2: Encode toàn bộ landing page bằng URL encoding
  const encodedLanding = encodeURIComponent(cleanLanding);

  // Bước 3: Ghép link
  let finalUrl = `${domainUrl}?origin_link=${encodedLanding}&affiliate_id=${encodeURIComponent(affId)}`;

  // Bước 4: Chuẩn hóa sub_id
  const formattedSubId = formatStandardSubId(subParams);
  if (formattedSubId) {
    finalUrl += `&sub_id=${encodeURIComponent(formattedSubId)}`;
  }

  return {
    finalUrl,
    cleanLanding,
    encodedLanding,
    affiliateId: affId,
    subId: formattedSubId,
    domainUrl
  };
}

/**
 * Tạo link Shopee Affiliate dạng deeplink từ CSDL hệ thống (Tương thích ngược)
 */
function createShopeeAffiliateLink(originUrl, subId = '', customBaseUrl = '', customAffId = '', country = 'VN') {
  validateShopeeUrl(originUrl);
  const result = buildShopeeAnRedirLink({
    originUrl,
    affiliateId: customAffId,
    subParams: subId,
    country,
    customBaseUrl
  });
  return result.finalUrl;
}

/**
 * Tra cứu thông tin sản phẩm và hoa hồng từ AddLiveTag API
 * @param {string} linkOrId - URL Shopee hoặc item ID
 * @param {string} apiKey - API Key AddLiveTag
 * @returns {Promise<Object>}
 */
async function fetchProductDataFromAddLiveTag(linkOrId, apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return {
      status: 'error',
      code: 'MISSING_API_KEY',
      message: 'Chưa cấu hình API Key AddLiveTag. Vui lòng cấu hình trong Admin Panel hoặc biến môi trường ADDLIVETAG_API_KEY.'
    };
  }

  const cleanInput = (linkOrId || '').trim();
  if (!cleanInput) {
    return {
      status: 'error',
      code: 'MISSING_INPUT',
      message: 'Vui lòng cung cấp link hoặc ID sản phẩm Shopee.'
    };
  }

  // Tự động phân giải short link Shopee (nếu có) trước khi truy vấn
  let resolvedUrl = cleanInput;
  const isItemId = /^\d+$/.test(cleanInput);
  if (!isItemId && (cleanInput.includes('shp.ee') || cleanInput.includes('s.shopee.vn'))) {
    try {
      resolvedUrl = await resolveShopeeShortLink(cleanInput);
    } catch (e) {
      resolvedUrl = cleanInput;
    }
  }

  const queryParam = isItemId ? `item_id=${cleanInput}` : `url=${encodeURIComponent(resolvedUrl)}`;
  const apiUrl = `https://data.addlivetag.com/product-data/product-data.php?${queryParam}&key=${encodeURIComponent(cleanKey)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': cleanKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (response.status === 429) {
      return {
        status: 'error',
        code: 'RATE_LIMIT',
        message: 'API AddLiveTag đang bị quá tải (Rate limit 429).'
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Fetch AddLiveTag Error:', err.message);
    return {
      status: 'error',
      code: 'NETWORK_ERROR',
      message: `Lỗi kết nối tới AddLiveTag: ${err.message}`
    };
  }
}

module.exports = {
  SHOPEE_AN_REDIR_DOMAINS,
  ensureUuid,
  validateShopeeUrl,
  generateClickId,
  normalizeShopeeProductUrl,
  resolveShopeeShortLink,
  formatStandardSubId,
  buildShopeeAnRedirLink,
  createShopeeAffiliateLink,
  generateShopeeAffiliateLink: createShopeeAffiliateLink, // alias for backwards compatibility
  fetchProductDataFromAddLiveTag
};
