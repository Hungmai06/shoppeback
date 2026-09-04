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

    // 3. Tạo Link 1 (Link Cookie Admin/Hệ thống) & Link 2 (Link Sản phẩm gốc)
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

    // 5. Nếu Admin thiết lập Link Hệ Thống riêng (không chứa an_redir), thực hiện chuyển hướng 2 bước (Link 1 -> sau 1.5s nhảy Link 2)
    const isCustomSystemLink = Boolean(customBaseUrl && customBaseUrl.trim() && !customBaseUrl.includes('an_redir'));

    if (isCustomSystemLink) {
      const htmlGateway = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shopee Redirect Gateway</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <script>
    const link1 = "${link1}";
    const link2 = "${link2}";

    // 1. Mở ngay Link 1 (Link cookie hệ thống Admin)
    window.location.href = link1;

    // 2. Sau 1.5s tự động nhảy tiếp sang Link 2 (Link sản phẩm gốc người dùng tìm)
    setTimeout(function() {
      window.location.href = link2;
    }, 1500);
  </script>
</body>
</html>
      `;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(htmlGateway);
    }

    // Nếu dùng link an_redir mặc định: Chuyển hướng trực tiếp 302 (Shopee an_redir tự động lưu cookie và nhảy về sản phẩm)
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

