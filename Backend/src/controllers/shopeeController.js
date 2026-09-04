const { validateShopeeUrl, generateClickId, createShopeeAffiliateLink, resolveShopeeShortLink, normalizeShopeeProductUrl } = require('../services/shopeeService');
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

    // 2. Sinh mã ngẫu nhiên cho click này (mã hóa không lộ user ID thật)
    const clickId = generateClickId();
    const subId = clickId; // sub_id trùng với mã tracking ngẫu nhiên (VD: CLK_a8f72c91)

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

    // 3. Tạo link an_redir chuẩn Shopee
    const affiliateLink = createShopeeAffiliateLink(originUrl, subId, customBaseUrl, customAffId);

    // 4. Lưu thông tin click & mapping (sub_id -> user_id) vào DB
    try {
      const userId = req.user ? req.user.id : null;
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, sub_id) VALUES (?, ?, ?, ?)',
        [clickId, userId, originUrl, subId]
      );
    } catch (dbErr) {
      console.warn('Click log insertion warning:', dbErr.message);
    }

    // 5. Trả về cho Frontend
    return res.json({
      success: true,
      affiliateLink,
      originUrl,
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
 * Nhận URL thô qua query parameter ?url=..., tự tạo sub_id, lưu log và 302 Redirect tới link Shopee an_redir
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

    // 2. Sinh clickId & subId
    const clickId = generateClickId();
    const subId = clickId;

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

    // 3. Tạo Link 1 (Link Cookie Admin) & Link 2 (Link Sản phẩm gốc)
    const link1 = createShopeeAffiliateLink(originUrl, subId, customBaseUrl, customAffId);
    const link2 = normalizeShopeeProductUrl(originUrl);

    // 4. Ghi log click vào DB
    try {
      const userId = req.user ? req.user.id : null;
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, sub_id) VALUES (?, ?, ?, ?)',
        [clickId, userId, originUrl, subId]
      );
    } catch (dbErr) {
      console.warn('Click log warning:', dbErr.message);
    }

    // 5. Chuyển hướng trực tiếp 302 tới Link Affiliate Shopee (Tự động lưu cookie & mở Shopee App trên điện thoại)
    return res.redirect(302, link1);

  } catch (error) {
    return res.status(400).send(`Lỗi chuyển hướng link Shopee: ${error.message}`);
  }
}

module.exports = {
  convertShopeeLink,
  createAffiliateLink: convertShopeeLink,
  redirectShopeeLink
};

