const { validateShopeeUrl, generateClickId, createShopeeAffiliateLink } = require('../services/shopeeService');
const { getDatabase } = require('../config/db');

async function convertShopeeLink(req, res) {
  try {
    const originUrl = req.body.url || req.body.originUrl;

    if (!originUrl) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu URL Shopee',
        message: 'Thiếu URL Shopee'
      });
    }

    // 1. Validate link Shopee Việt Nam
    validateShopeeUrl(originUrl);

    // 2. Sinh mã ngẫu nhiên cho click này (mã hóa không lộ user ID thật)
    const clickId = generateClickId();
    const subId = clickId; // sub_id trùng với mã tracking ngẫu nhiên (VD: CLK_a8f72c91)

    // 3. Tạo link an_redir chuẩn Shopee
    const affiliateLink = createShopeeAffiliateLink(originUrl, subId);

    // 4. Lưu thông tin click & mapping (sub_id -> user_id) vào DB
    try {
      const db = await getDatabase();
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

module.exports = {
  convertShopeeLink,
  createAffiliateLink: convertShopeeLink
};
