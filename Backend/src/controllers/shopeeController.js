const { validateShopeeUrl, generateClickId, createShopeeAffiliateLink } = require('../services/shopeeService');
const { extractShopeeIds } = require('../services/affiliateMatchingService');
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

    // 3. Trích xuất item_id và shop_id từ URL hoặc Body (phục vụ matching fallback)
    const extracted = extractShopeeIds(originUrl);
    const itemId = req.body.itemId || req.body.item_id || extracted.itemId || null;
    const shopId = req.body.shopId || req.body.shop_id || extracted.shopId || null;

    // 4. Tạo link an_redir chuẩn Shopee
    const affiliateLink = createShopeeAffiliateLink(originUrl, subId);

    // 5. Lưu thông tin click vào affiliate_clicks & click_logs trong DB
    try {
      const db = await getDatabase();
      const userId = req.user ? req.user.id : null;
      const clickedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // Lưu bảng affiliate_clicks
      await db.run(
        `INSERT INTO affiliate_clicks (id, user_id, click_id, sub_id, item_id, shop_id, origin_url, clicked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [clickId, userId, clickId, subId, itemId, shopId, originUrl, clickedAt]
      );

      // Lưu bảng click_logs để tương thích ngược 100%
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, sub_id) VALUES (?, ?, ?, ?)',
        [clickId, userId, originUrl, subId]
      );

      // Lưu bảng orders để hiển thị trong Tra cứu đơn hàng & Ví tiền
      if (userId) {
        const productName = req.body.productName || req.body.name || 'Sản phẩm Shopee';
        const productImage = req.body.productImage || req.body.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400';
        const orderAmount = Number(req.body.orderAmount || req.body.price || 0);
        const estimatedCashback = Number(req.body.estimatedCashback || Math.round(orderAmount * 0.035));
        const shopeeCommission = Number(req.body.commission || (estimatedCashback * 2));

        await db.run(
          `INSERT OR REPLACE INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
          [clickId, userId, clickId, productName, productImage, orderAmount, estimatedCashback, shopeeCommission, clickedAt]
        );
      }
    } catch (dbErr) {
      console.warn('Click log insertion warning:', dbErr.message);
    }

    // 6. Trả về cho Frontend
    return res.json({
      success: true,
      affiliateLink,
      originUrl,
      clickId,
      subId,
      itemId,
      shopId
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
