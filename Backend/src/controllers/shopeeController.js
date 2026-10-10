const {
  validateShopeeUrl,
  generateClickId,
  createShopeeAffiliateLink,
  resolveShopeeShortLink,
  normalizeShopeeProductUrl,
  fetchProductDataFromAddLiveTag,
  formatStandardSubId,
  buildShopeeAnRedirLink
} = require('../services/shopeeService');
const { getDatabase } = require('../config/db');

async function convertShopeeLink(req, res) {
  try {
    const rawOriginUrl = req.body.url || req.body.originUrl;

    if (!rawOriginUrl) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu URL Shopee',
        message: 'Thiếu URL Shopee'
      });
    }

    // 1. Validate link Shopee Việt Nam
    validateShopeeUrl(rawOriginUrl);

    // Giải mã short link (nếu người dùng dán link rút gọn dạng vn.shp.ee / shope.ee)
    const originUrl = await resolveShopeeShortLink(rawOriginUrl);

    // 2. Sinh mã tracking clickId và chuẩn hóa sub_id 5 vị trí theo chuẩn 2026:
    // sub1 = Publisher/KOL (User ID) | sub2 = Campaign | sub3 = Source | sub4 = Post ID | sub5 = Tracking Click ID
    const clickId = generateClickId();
    const resolvedUserId = req.user ? req.user.id : (req.body.user_id || req.body.userId || null);
    const userTag = resolvedUserId ? String(resolvedUserId).replace(/-/g, '_') : 'guest';
    const rawSub = req.body.sub_id || req.body.subParams || req.body.subId;
    const subParams = rawSub || {
      sub1: req.body.sub1 || userTag,
      sub2: req.body.sub2 || 'cashback',
      sub3: req.body.sub3 || 'web',
      sub4: req.body.sub4 || '',
      sub5: req.body.sub5 || clickId
    };
    const subId = formatStandardSubId(subParams);

    // Lấy cấu hình hệ thống từ CSDL nếu có
    let customBaseUrl = '';
    let customAffId = '';
    const db = await getDatabase();
    try {
      const settings = await db.get('SELECT shopee_affiliate_id, shopee_cookie_url FROM system_settings WHERE id = 1');
      if (settings) {
        customBaseUrl = settings.shopee_cookie_url;
        customAffId = settings.shopee_affiliate_id;
      }
    } catch (sErr) {}

    // 3. Tạo link an_redir chuẩn Shopee 2026
    const country = req.body.country || 'VN';
    const affiliateLink = createShopeeAffiliateLink(originUrl, subId, customBaseUrl, customAffId, country);

    // 4. Lưu thông tin click & mapping (sub_id -> user_id) vào DB
    try {
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, sub_id) VALUES (?, ?, ?, ?)',
        [clickId, resolvedUserId, originUrl, subId]
      );
    } catch (dbErr) {
      console.warn('Click log insertion warning:', dbErr.message);
    }

    // 5. Trả về cho Frontend (Kèm cờ isCustomSystemLink nếu Admin dùng link hệ thống riêng không chứa an_redir)
    const isCustomSystemLink = Boolean(customBaseUrl && customBaseUrl.trim() && !customBaseUrl.includes('an_redir'));

    return res.json({
      success: true,
      affiliateLink,
      originUrl,
      isCustomSystemLink,
      clickId,
      subId
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'URL không hợp lệ',
      message: error.message || 'URL không hợp lệ'
    });
  }
}

/**
 * Xử lý chuyển hướng trực tiếp (GET Redirect Gateway)
 * Nhận URL thô qua query parameter ?url=..., tự tạo sub_id, lưu log và Redirect tới link Shopee
 */
async function redirectShopeeLink(req, res) {
  try {
    const rawOriginUrl = req.query.url;

    if (!rawOriginUrl) {
      return res.status(400).send('Thiếu tham số URL Shopee (?url=)');
    }

    // 1. Validate link Shopee
    validateShopeeUrl(rawOriginUrl);

    // Giải mã short link nếu có
    const originUrl = await resolveShopeeShortLink(rawOriginUrl);

    // 2. Sinh clickId & subId chuẩn 2026
    const clickId = generateClickId();
    const resolvedUserId = req.user ? req.user.id : (req.query.user_id || req.query.userId || null);
    const userTag = resolvedUserId ? String(resolvedUserId).replace(/-/g, '_') : 'guest';
    const subParams = req.query.sub_id || {
      sub1: req.query.sub1 || userTag,
      sub2: req.query.sub2 || 'cashback',
      sub3: req.query.sub3 || 'web',
      sub4: req.query.sub4 || '',
      sub5: req.query.sub5 || clickId
    };
    const subId = formatStandardSubId(subParams);

    // Lấy cấu hình hệ thống từ CSDL nếu có
    let customBaseUrl = '';
    let customAffId = '';
    const db = await getDatabase();
    try {
      const settings = await db.get('SELECT shopee_affiliate_id, shopee_cookie_url FROM system_settings WHERE id = 1');
      if (settings) {
        customBaseUrl = settings.shopee_cookie_url;
        customAffId = settings.shopee_affiliate_id;
      }
    } catch (sErr) {}

    // 3. Tạo Link 1 (Link Cookie an_redir chuẩn 2026) & Link 2 (Link Sản phẩm gốc)
    const link1 = createShopeeAffiliateLink(originUrl, subId, customBaseUrl, customAffId);

    // 4. Ghi log click vào DB
    try {
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, sub_id) VALUES (?, ?, ?, ?)',
        [clickId, resolvedUserId, originUrl, subId]
      );
    } catch (dbErr) {
      console.warn('Click log warning:', dbErr.message);
    }

    // 5. Chuyển hướng trực tiếp 302 sang link Shopee an_redir chuẩn 2026 (Shopee tự động lưu cookie và mở sản phẩm ngay lập tức)
    return res.redirect(302, link1);

  } catch (error) {
    return res.status(400).send(`Lỗi chuyển hướng link Shopee: ${error.message}`);
  }
}

/**
 * Tra cứu thông tin sản phẩm Shopee qua AddLiveTag (Bảo mật API Key & chống lỗi CORS phía trình duyệt)
 */
async function getProductInfo(req, res) {
  try {
    const rawInput = req.query.url || req.query.item_id || req.query.link || req.body?.url || req.body?.item_id;
    if (!rawInput) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_INPUT',
        message: 'Thiếu link hoặc ID sản phẩm Shopee'
      });
    }

    let apiKey = process.env.ADDLIVETAG_API_KEY || '';
    try {
      const db = await getDatabase();
      const settings = await db.get('SELECT addlivetag_api_key FROM system_settings WHERE id = 1');
      if (settings && settings.addlivetag_api_key && settings.addlivetag_api_key.trim()) {
        apiKey = settings.addlivetag_api_key.trim();
      }
    } catch (dbErr) {
      console.warn('DB read error in getProductInfo:', dbErr.message);
    }

    if (!apiKey) {
      return res.json({
        status: 'error',
        code: 'MISSING_API_KEY',
        message: 'Hệ thống chưa được cấu hình API Key AddLiveTag. Vui lòng vào Cài đặt Quản trị viên (Admin Panel) để nhập API Key từ addlivetag.com.'
      });
    }

    const result = await fetchProductDataFromAddLiveTag(rawInput, apiKey);
    return res.json(result);
  } catch (err) {
    console.error('getProductInfo Error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: err.message || 'Lỗi máy chủ khi tra cứu thông tin sản phẩm'
    });
  }
}

module.exports = {
  convertShopeeLink,
  createAffiliateLink: convertShopeeLink,
  redirectShopeeLink,
  getProductInfo
};

