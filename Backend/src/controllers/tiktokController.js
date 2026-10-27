/**
 * tiktokController.js
 * Controller xử lý luồng tạo link hoàn tiền, tra cứu sản phẩm và nhận Webhook TikTok Shop qua RioHub
 */

const {
  createAffiliateLink,
  createAffiliateProductLink,
  createGeneralLinks,
  getAffiliateOrders,
  getProductInfo,
  getAffiliateLinks,
  buildSubId,
  parseSubId,
  getRiohubApiKey,
  verifyWebhookSignature
} = require('../services/riohubService');
const { getDatabase } = require('../config/db');
const { recalculateUserBalances } = require('../services/balanceService');

/**
 * Sinh mã tracking clickId độc nhất cho hệ thống
 */
function generateClickId() {
  return 'TT' + Date.now() + Math.random().toString(36).substring(2, 8);
}

/**
 * Kiểm tra xem URL có thuộc TikTok hoặc TikTok Shop không
 */
function isValidTikTokUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  return (
    lower.includes('tiktok.com') ||
    lower.includes('vt.tiktok.com') ||
    lower.includes('shop.tiktok.com') ||
    lower.includes('snssdk.com')
  );
}

/**
 * Chuẩn hóa dữ liệu sản phẩm TikTok Shop trả về từ RioHub (Chuẩn V202509)
 * - Tên sản phẩm: title
 * - Ảnh chính: main_image_url
 * - Giá bán: sales_price.{min,max}_amount (rỗng thì dùng original_price)
 * - Hoa hồng: ưu tiên observed_commission.commission_rate (đã gồm hoa hồng thưởng); fallback commission.rate (+ shop_ads_commission.rate)
 */
function formatTikTokProduct(p, cashbackRate = 0.5, rawUrl = '') {
  if (!p) return null;

  const productId = String(p.id || p.product_id || '').trim();
  const name = p.title || p.product_name || p.name || 'Sản phẩm TikTok Shop';
  const image = p.main_image_url || p.image_url || p.image || '';
  const shopName = p.shop?.name || p.shop_name || 'TikTok Shop Store';
  const unitsSold = Number(p.units_sold || 0);
  const detailLink = p.detail_link || p.product_url || rawUrl || '';

  // Giá bán: sales_price.{minimum_amount, maximum_amount} hoặc original_price
  let price = 0;
  let originalPrice = 0;

  if (p.sales_price && typeof p.sales_price === 'object') {
    price = Number(p.sales_price.minimum_amount || p.sales_price.maximum_amount || 0);
  } else if (p.sales_price) {
    price = Number(p.sales_price || 0);
  }

  if (p.original_price && typeof p.original_price === 'object') {
    originalPrice = Number(p.original_price.minimum_amount || p.original_price.maximum_amount || 0);
  } else if (p.original_price) {
    originalPrice = Number(p.original_price || 0);
  }

  // Nếu sales_price rỗng thì dùng original_price
  if (!price || price <= 0) {
    price = originalPrice;
  }
  if (!originalPrice || originalPrice <= 0) {
    originalPrice = price;
  }

  // Tính tỷ lệ hoa hồng và số tiền hoa hồng:
  // RioHub trả về:
  // "commission": { "rate": 600, "amount": "3299.94", "currency": "VND" }
  let commissionAmount = 0;
  if (p.commission?.amount) {
    commissionAmount = Number(p.commission.amount);
  }

  let rawRate = 0;
  let isObserved = false;
  let bonusRate = 0;

  if (p.observed_commission && p.observed_commission.commission_rate) {
    rawRate = Number(p.observed_commission.commission_rate);
    bonusRate = (Number(p.observed_commission.commission_bonus_rate) || 0) / 100;
    isObserved = true;
  } else if (p.commission?.rate) {
    rawRate = Number(p.commission.rate);
  } else {
    const baseRate = Number(p.commission?.rate || 0);
    const adsRate = Number(p.shop_ads_commission?.rate || 0);
    rawRate = baseRate + adsRate;
  }

  // RioHub: rate = 600 tương ứng 6%, rate = 1000 tương ứng 10%
  let ratePercent = 10;
  if (rawRate > 0) {
    ratePercent = rawRate >= 100 ? (rawRate / 100) : rawRate;
  } else if (price > 0 && commissionAmount > 0) {
    ratePercent = Number(((commissionAmount / price) * 100).toFixed(1));
  }

  let totalComm = 0;
  if (commissionAmount > 0) {
    totalComm = Math.floor(commissionAmount);
  } else if (price > 0) {
    totalComm = Math.floor(price * (ratePercent / 100));
  }

  const estCashback = Math.floor(totalComm * cashbackRate);
  const userCashbackRate = Number((ratePercent * cashbackRate).toFixed(1));

  return {
    productId,
    name,
    image,
    price,
    originalPrice,
    commissionRate: ratePercent,
    userCashbackRate, // Chính xác 50% tỷ lệ hoa hồng API
    commissionAmount: totalComm,
    bonusRate,
    isObserved,
    observedScope: p.observed_commission?.scope || '',
    commissionAmountRange: p.commission?.amount ? `${p.commission.amount} ${p.commission.currency || 'VND'}` : '',
    estimatedCommission: totalComm,
    estimatedCashback: estCashback,
    shopName,
    sales: unitsSold,
    url: detailLink,
    hasInventory: p.has_inventory ?? true,
    categoryChains: p.category_chains || []
  };
}

/**
 * 1. Chuyển đổi link sản phẩm TikTok Shop sang link affiliate có gắn sub_id
 * Route: POST /api/tiktok/convert
 */
async function convertTikTokLink(req, res) {
  try {
    const rawUrl = req.body.url || req.body.product_url || req.body.originUrl;
    const rawProductId = req.body.productId || req.body.product_id;

    if (!rawUrl && !rawProductId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp link sản phẩm TikTok hoặc Product ID'
      });
    }

    if (rawUrl && !isValidTikTokUrl(rawUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Link không hợp lệ! Vui lòng nhập link sản phẩm TikTok Shop (ví dụ: vt.tiktok.com/...)'
      });
    }

    const clickId = generateClickId();
    const resolvedUserId = req.user ? req.user.id : (req.body.user_id || req.body.userId || '');
    
    // Tạo sub_id chuẩn RioHub: sub1(userId)-sub2(clickId)-sub3(source)-sub4
    const subId = buildSubId({
      userId: resolvedUserId,
      clickId,
      source: req.body.source || 'web'
    });

    const db = await getDatabase();
    const settings = await db.get('SELECT * FROM system_settings WHERE id = 1');

    let affiliateLink = '';
    let productId = rawProductId || '';
    let creatorUsername = '';
    let isViaRiohub = false;
    let riohubErrorMsg = '';

    // Cố gắng bóc tách Product ID từ URL dạng direct (nếu có)
    if (!productId && rawUrl) {
      const idMatch = rawUrl.match(/(?:product\/|item\/|product_id=)(\d{15,22})/i);
      if (idMatch) {
        productId = idMatch[1];
      }
    }

    const hasRiohubKey = Boolean(process.env.RIOHUB_API_KEY || (settings && settings.riohub_api_key));
    let productInfo = null;
    const cashbackRate = (settings && settings.cashback_percentage) ? Number(settings.cashback_percentage) / 100 : 0.5;

    // A. Ưu tiên gọi qua RioHub API nếu đã cấu hình API Key
    if (hasRiohubKey) {
      try {
        // 1. Dùng POST /partner/tiktok/affiliate/product-links: Tạo link + lấy thông tin sản phẩm (1 request)
        let riohubRes = null;
        try {
          riohubRes = await createAffiliateProductLink({
            productUrl: rawUrl,
            productId: productId || rawProductId,
            subId
          });
        } catch (pLinkErr) {
          console.warn('[RioHub product-links fallback to links]:', pLinkErr.message);
          // Fallback sang endpoint links thông thường nếu product-links gặp lỗi
          riohubRes = await createAffiliateLink({
            productUrl: rawUrl,
            productId: productId || rawProductId,
            subId
          });
        }

        if (riohubRes && riohubRes.affiliate_link) {
          affiliateLink = riohubRes.affiliate_link;
          productId = riohubRes.product_id || productId;
          creatorUsername = riohubRes.creator_username || '';
          isViaRiohub = true;

          // Nếu có object product từ phản hồi product-links
          if (riohubRes.product) {
            productInfo = formatTikTokProduct(riohubRes.product, cashbackRate, rawUrl);
          }
        }
      } catch (rioErr) {
        riohubErrorMsg = rioErr.message || '';
        console.warn('[RioHub Convert Error]', rioErr.message);
        // Nếu lỗi RioHub thì fallback sang Cookie / Deeplink cấu hình tay bên dưới
      }
    }

    // B. Fallback: Nếu RioHub chưa có key hoặc link không tạo được, sử dụng Deeplink / Cookie URL của Admin
    if (!affiliateLink) {
      const fallbackCookieUrl = (settings && settings.tiktok_cookie_url && settings.tiktok_cookie_url.trim())
        ? settings.tiktok_cookie_url.trim()
        : 'https://vt.tiktok.com/an_redir';

      const separator = fallbackCookieUrl.includes('?') ? '&' : '?';
      affiliateLink = `${fallbackCookieUrl}${separator}url=${encodeURIComponent(rawUrl || '')}&sub_id=${encodeURIComponent(subId)}`;
    }

    // C. Lưu click log vào database để đối soát đơn hàng sau này
    try {
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, sub_id, item_id) VALUES (?, ?, ?, ?, ?)',
        [clickId, resolvedUserId || null, rawUrl || '', subId, productId || null]
      );
    } catch (logErr) {
      console.warn('Lỗi ghi click log TikTok:', logErr.message);
    }

    // D. Nếu chưa có thông tin sản phẩm từ product-links nhưng có productId, thử tra cứu bổ sung qua getProductInfo
    if (!productInfo && productId && hasRiohubKey) {
      try {
        const prodData = await getProductInfo([productId], creatorUsername);
        if (prodData && prodData.products && prodData.products.length > 0) {
          productInfo = formatTikTokProduct(prodData.products[0], cashbackRate, rawUrl);
        }
      } catch (pErr) {
        console.warn('Lỗi tra cứu chi tiết sản phẩm TikTok:', pErr.message);
      }
    }

    if (!productInfo) {
      productInfo = {
        productId: productId || 'TIKTOK_ITEM',
        name: 'Sản phẩm TikTok Shop (Kèm mã hoàn tiền tự động)',
        image: '',
        price: 0,
        originalPrice: 0,
        commissionRate: 12,
        estimatedCashback: 0,
        shopName: 'TikTok Shop Official',
        sales: 0,
        url: rawUrl,
        isEstimated: true
      };
    }

    return res.json({
      success: true,
      affiliateLink,
      subId,
      productId,
      creatorUsername,
      clickId,
      productInfo,
      mode: isViaRiohub ? 'riohub_api' : 'deeplink_cookie',
      message: 'Đã tra cứu thông tin hoàn tiền TikTok Shop thành công'
    });
  } catch (error) {
    console.error('convertTikTokLink Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi xử lý link TikTok Shop'
    });
  }
}

/**
 * 2. Lấy thông tin sản phẩm và hoa hồng TikTok Shop từ RioHub
 * Route: GET /api/tiktok/product-info?product_ids=...&creator_username=...
 */
async function getTikTokProductInfo(req, res) {
  try {
    const rawIds = req.query.product_id || req.query.product_ids || req.query.productId || req.query.id;
    if (!rawIds) {
      return res.status(400).json({ success: false, message: 'Thiếu product_id' });
    }

    const creatorUsername = req.query.creator_username || '';
    const productIds = String(rawIds).split(',').map(s => s.trim()).filter(Boolean);
    const data = await getProductInfo(productIds, creatorUsername);

    const db = await getDatabase();
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings && settings.cashback_percentage) ? Number(settings.cashback_percentage) / 100 : 0.5;

    const products = (data?.products || []).map(p => formatTikTokProduct(p, cashbackRate));

    return res.json({
      success: true,
      creator_username: data?.creator_username || creatorUsername,
      requested: data?.requested || productIds.length,
      found: data?.found || products.length,
      products,
      not_found: data?.not_found || []
    });
  } catch (error) {
    console.error('getTikTokProductInfo Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lỗi tra cứu thông tin sản phẩm TikTok'
    });
  }
}

/**
 * 3. Tạo deep link mở app theo lô (Batch)
 * Route: POST /api/tiktok/general-links
 */
async function createTikTokGeneralLinks(req, res) {
  try {
    const { product_ids } = req.body;
    if (!product_ids || !Array.isArray(product_ids)) {
      return res.status(400).json({ success: false, message: 'product_ids phải là một mảng' });
    }

    const data = await createGeneralLinks(product_ids);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('createTikTokGeneralLinks Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lỗi tạo batch general links'
    });
  }
}

/**
 * 4. Nhận Webhook / Postback từ RioHub khi có đơn hàng TikTok Shop
 * Route: POST /api/tiktok/webhook & POST /api/tiktok/postback
 * 
 * QUY TẮC: Server phải trả HTTP 2xx trong vòng 5 giây để tránh RioHub retry.
 * Mọi tác vụ ghi database & tính toán số dư được xử lý cẩn thận.
 */
async function handleTikTokWebhook(req, res) {
  // Trả về HTTP 200 NGAY LẬP TỨC (< 5s) theo khuyến nghị từ RioHub
  res.status(200).json({
    success: true,
    message: 'RioHub Webhook received successfully',
    timestamp: new Date().toISOString()
  });

  // Xử lý dữ liệu đơn hàng bất đồng bộ
  try {
    const rawBody = req.body;
    const signature = req.headers['x-riohub-signature'] || '';

    // Lấy secret từ settings nếu có
    const db = await getDatabase();
    let webhookSecret = process.env.RIOHUB_WEBHOOK_SECRET || '';
    try {
      const settings = await db.get('SELECT riohub_webhook_secret FROM system_settings WHERE id = 1');
      if (settings?.riohub_webhook_secret) {
        webhookSecret = settings.riohub_webhook_secret;
      }
    } catch (e) {}

    // Xác minh chữ ký nếu hệ thống đã cài secret
    if (webhookSecret && !verifyWebhookSignature(JSON.stringify(rawBody), signature, webhookSecret)) {
      console.warn('⚠️ [RioHub Webhook] Chữ ký X-Riohub-Signature không hợp lệ! Bỏ qua sự kiện.');
      return;
    }

    const event = rawBody.event || rawBody.event_type;
    const eventId = rawBody.event_id || rawBody.id;
    const orderData = rawBody.data || rawBody.order || rawBody;

    console.log(`[RioHub Webhook] Nhận sự kiện: ${event} (Event ID: ${eventId})`);

    const orderId = String(orderData.order_id || orderData.id || '').trim();
    if (!orderId) {
      console.warn('[RioHub Webhook] Dữ liệu đơn thiếu order_id');
      return;
    }

    const subId = orderData.sub_id || orderData.subId || '';
    const parsed = parseSubId(subId);
    let targetUserId = parsed.userId || null;
    let targetClickId = parsed.clickId || null;

    // Nếu subId không parse được userId trực tiếp, tra cứu ngược từ click_logs
    if (!targetUserId && targetClickId) {
      const clickRow = await db.get('SELECT user_id FROM click_logs WHERE id = ?', [targetClickId]);
      if (clickRow && clickRow.user_id) {
        targetUserId = clickRow.user_id;
      }
    } else if (!targetUserId && subId) {
      const clickRow = await db.get('SELECT user_id, id FROM click_logs WHERE sub_id = ? ORDER BY click_time DESC LIMIT 1', [subId]);
      if (clickRow) {
        targetUserId = clickRow.user_id;
        targetClickId = targetClickId || clickRow.id;
      }
    }

    // Lấy tỷ lệ hoàn tiền cài đặt trong hệ thống (mặc định 50%)
    let cashbackRate = 0.5;
    try {
      const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
      if (settings?.cashback_percentage) {
        cashbackRate = Number(settings.cashback_percentage) / 100;
      }
    } catch (e) {}

    const orderAmount = Number(orderData.order_amount || orderData.pay_amount || orderData.amount || 0);
    // Hoa hồng dự kiến từ sàn (100%)
    const estCommission = Number(orderData.est_commission || orderData.commission_amount || orderData.estimated_commission || orderData.commission || 0);
    // Hoa hồng thực tế từ sàn sau đối soát (100%)
    const actualCommission = Number(orderData.actual_commission || orderData.settled_commission || estCommission);

    // Chuẩn hóa trạng thái đơn theo quy chuẩn hệ thống:
    // 1 / pending -> 'pending'
    // 2 / settled / settled_status -> 'approved'
    // 3 / cancelled / refunded -> 'rejected'
    let orderStatus = 'pending';
    const rawStatus = String(orderData.status || orderData.settlement_status || '').toLowerCase();

    if (rawStatus === '2' || rawStatus === 'settled' || rawStatus === 'completed' || event === 'order.settled') {
      orderStatus = 'approved';
    } else if (rawStatus === '3' || rawStatus === 'cancelled' || rawStatus === 'refunded' || event === 'order.refunded') {
      orderStatus = 'rejected';
    } else {
      orderStatus = 'pending';
    }

    // Hoàn 50% giá trị sau đối soát kể cả hoa hồng dự kiến cũng báo 50%
    const estimatedCashback = Math.floor(estCommission * cashbackRate);
    const realCashback = (orderStatus === 'approved') ? Math.floor(actualCommission * cashbackRate) : 0;
    const finalCommission = (orderStatus === 'approved' && actualCommission > 0) ? actualCommission : estCommission;
    const productName = orderData.product_name || orderData.sku_name || 'Đơn hàng TikTok Shop';
    const productImage = orderData.product_image || orderData.image_url || '';

    // Kiểm tra đơn hàng đã tồn tại chưa
    const existingOrder = await db.get('SELECT id, status FROM tiktok_orders WHERE id = ?', [orderId]);

    if (existingOrder) {
      await db.run(
        `UPDATE tiktok_orders
         SET status = ?,
             order_amount = CASE WHEN ? > 0 THEN ? ELSE order_amount END,
             tiktok_commission = CASE WHEN ? > 0 THEN ? ELSE tiktok_commission END,
             estimated_cashback = ?,
             real_cashback = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [orderStatus, orderAmount, orderAmount, finalCommission, finalCommission, estimatedCashback, realCashback, orderId]
      );
      console.log(`[TikTok Webhook] Đã cập nhật trạng thái đơn ${orderId} -> ${orderStatus} (Hoàn dự kiến: ${estimatedCashback}, Thực nhận: ${realCashback})`);
    } else {
      await db.run(
        `INSERT INTO tiktok_orders (
          id, user_id, click_id, product_name, product_image,
          order_amount, estimated_cashback, real_cashback, tiktok_commission,
          status, sub_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          targetUserId,
          targetClickId,
          productName,
          productImage,
          orderAmount,
          estimatedCashback,
          realCashback,
          finalCommission,
          orderStatus,
          subId,
          `TikTok Shop | SubID: ${subId}`
        ]
      );
      console.log(`[TikTok Webhook] Đã ghi nhận đơn hàng mới ${orderId} (User: ${targetUserId || 'Ẩn danh'}, Trạng thái: ${orderStatus})`);
    }

    // Nếu đơn thuộc về user, tự động đồng bộ lại số dư ví ngay lập tức!
    if (targetUserId) {
      await recalculateUserBalances(db, [targetUserId]);
      console.log(`[RioHub Webhook] Đã cập nhật số dư cho User ID: ${targetUserId}`);
    }
  } catch (err) {
    console.error('Lỗi bất đồng bộ khi xử lý Webhook RioHub:', err);
  }
}

/**
 * 5. Đồng bộ đơn hàng từ RioHub về hệ thống (Dành cho Quản trị viên hoặc Cron Job)
 * Route: POST /api/tiktok/sync-orders
/**
 * Helper tra cứu user_id từ thông tin đơn hàng RioHub (sub1, sub_id, trace_id, click_logs)
 */
async function resolveTikTokUser(db, item) {
  if (!item) return null;

  // 1. Nếu có user_id trực tiếp
  if (item.user_id) {
    const u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [String(item.user_id)]);
    if (u) return u;
  }

  // 2. Tra cứu qua sub1 (vd "u27765" hoặc "admin")
  const sub1 = item.sub1 ? String(item.sub1).trim() : '';
  if (sub1) {
    let u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [sub1]);
    if (!u && /^u\d+$/i.test(sub1)) {
      u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [sub1.substring(1)]);
    }
    if (!u) {
      u = await db.get('SELECT id, name, email FROM users WHERE affiliate_sub_id = ? OR email LIKE ?', [sub1, `%${sub1}%`]);
    }
    if (u) return u;
  }

  // 3. Tra cứu qua chuỗi sub_id
  const subId = item.sub_id ? String(item.sub_id).trim() : '';
  if (subId) {
    const parsed = parseSubId(subId);
    if (parsed.userId) {
      let u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [parsed.userId]);
      if (!u && /^u\d+$/i.test(parsed.userId)) {
        u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [parsed.userId.substring(1)]);
      }
      if (u) return u;
    }
  }

  // 4. Tra cứu qua trace_id / clickId trong click_logs
  const traceId = item.trace_id ? String(item.trace_id).trim() : '';
  const clickId = (item.sub2 ? String(item.sub2).trim() : '') || traceId;
  if (clickId) {
    const cRow = await db.get('SELECT user_id FROM click_logs WHERE id = ? OR sub_id = ?', [clickId, clickId]);
    if (cRow && cRow.user_id) {
      const u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [cRow.user_id]);
      if (u) return u;
    }
  }

  if (subId) {
    const cRow = await db.get('SELECT user_id FROM click_logs WHERE sub_id = ?', [subId]);
    if (cRow && cRow.user_id) {
      const u = await db.get('SELECT id, name, email FROM users WHERE id = ?', [cRow.user_id]);
      if (u) return u;
    }
  }

  return null;
}

/**
 * 5. Admin truy vấn trực tiếp đơn hàng affiliate từ RioHub API (GET /partner/tiktok/affiliate/orders)
 * Route: GET /api/tiktok/admin/riohub-orders
 */
async function adminQueryRiohubOrders(req, res) {
  try {
    const filters = req.query || {};
    const data = await getAffiliateOrders(filters);
    const rawOrders = data?.orders || data?.data || [];

    const db = await getDatabase();

    // Tỷ lệ hoàn tiền mặc định
    let cashbackRate = 0.5;
    try {
      const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
      if (settings?.cashback_percentage) {
        cashbackRate = Number(settings.cashback_percentage) / 100;
      }
    } catch (e) {}

    // Làm giàu dữ liệu với trạng thái nội bộ & đối soát người dùng
    const enrichedOrders = await Promise.all(
      rawOrders.map(async (item) => {
        const orderId = String(item.order_id || item.id || '').trim();
        const existing = await db.get(
          'SELECT id, user_id, status, real_cashback, estimated_cashback, tiktok_commission, order_amount FROM tiktok_orders WHERE id = ?',
          [orderId]
        );

        let matchedUser = null;
        if (existing && existing.user_id) {
          matchedUser = await db.get('SELECT id, name, email FROM users WHERE id = ?', [existing.user_id]);
        }
        if (!matchedUser) {
          matchedUser = await resolveTikTokUser(db, item);
        }

        const orderAmount = Number(item.price || item.commission_gmv || item.order_amount || item.pay_amount || 0);
        const estCommission = Number(item.est_commission || item.commission_amount || item.commission || 0);
        const actualCommission = Number(item.actual_commission || estCommission);

        // Kể cả hoa hồng dự kiến cũng báo 50%
        const estCashback = Math.floor(estCommission * cashbackRate);

        const rawStat = String(item.status || '').trim();
        const settlementStat = String(item.settlement_status || '').toUpperCase().trim();
        const isSettled = rawStat === '2' || settlementStat === 'SETTLED' || rawStat === 'settled' || rawStat === 'completed';

        // Hoàn 50% giá trị sau đối soát
        const realCashback = isSettled ? Math.floor(actualCommission * cashbackRate) : 0;
        const commAmount = (isSettled && actualCommission > 0) ? actualCommission : estCommission;

        return {
          ...item,
          order_id: orderId,
          order_amount: orderAmount,
          est_commission: estCommission,
          actual_commission: actualCommission,
          commission_amount: commAmount,
          estimated_cashback: estCashback,
          real_cashback: realCashback,
          is_imported: Boolean(existing),
          local_order: existing || null,
          local_status: existing ? existing.status : null,
          matched_user: matchedUser || null
        };
      })
    );

    return res.json({
      success: true,
      creator_username: data?.creator_username || filters.creator_username || '',
      page: Number(data?.page || filters.page || 1),
      page_size: Number(data?.page_size || filters.page_size || 50),
      total: Number(data?.total || enrichedOrders.length),
      orders: enrichedOrders
    });
  } catch (error) {
    console.error('adminQueryRiohubOrders Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lỗi khi truy vấn đơn hàng từ RioHub'
    });
  }
}

/**
 * 6. Đồng bộ / Đối soát đơn hàng từ RioHub về hệ thống
 * Route: POST /api/tiktok/sync-orders
 */
async function syncTikTokOrders(req, res) {
  try {
    const {
      orders: passedOrders,
      creator_username,
      time_start,
      time_end,
      update_time_start,
      update_time_end,
      order_id,
      product_id,
      status,
      settlement_status,
      content_type,
      sub_id,
      trace_id,
      page,
      page_size
    } = req.body;

    let orderList = [];

    // Nếu admin truyền danh sách đơn đã chọn từ Preview
    if (Array.isArray(passedOrders) && passedOrders.length > 0) {
      orderList = passedOrders;
    } else {
      // Truy vấn trực tiếp từ RioHub API theo bộ lọc
      const filters = {
        creator_username,
        time_start,
        time_end,
        update_time_start,
        update_time_end,
        order_id,
        product_id,
        status,
        settlement_status,
        content_type,
        sub_id,
        trace_id,
        page,
        page_size: page_size || 100
      };
      const data = await getAffiliateOrders(filters);
      orderList = data?.orders || data?.data || [];
    }

    const db = await getDatabase();
    const result = await processTikTokOrders(db, orderList);

    return res.json({
      success: true,
      message: `Đối soát hoàn tất: ${result.importedCount} đơn mới, ${result.updatedCount} đơn cập nhật (${result.settledCount} đơn hoàn thành đối soát)`,
      totalOrders: orderList.length,
      importedCount: result.importedCount,
      updatedCount: result.updatedCount,
      settledCount: result.settledCount,
      affectedUsersCount: result.affectedUsersCount
    });
  } catch (error) {
    console.error('syncTikTokOrders Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lỗi khi đồng bộ đơn hàng TikTok'
    });
  }
}

/**
 * Xử lý danh sách đơn hàng TikTok vào Database và tự động tính lại số dư thành viên
 */
async function processTikTokOrders(db, orderList = []) {
  const affectedUserIds = new Set();
  let importedCount = 0;
  let updatedCount = 0;
  let settledCount = 0;

  let cashbackRate = 0.5;
  try {
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    if (settings?.cashback_percentage) {
      cashbackRate = Number(settings.cashback_percentage) / 100;
    }
  } catch (e) {}

  for (const item of orderList) {
    const orderId = String(item.order_id || item.id || '').trim();
    if (!orderId) continue;

    const subId = item.sub_id || '';
    const orderAmount = Number(item.price || item.commission_gmv || item.order_amount || item.pay_amount || 0);
    const estCommission = Number(item.est_commission || item.commission_amount || item.commission || 0);
    const actualCommission = Number(item.actual_commission || estCommission);

    let orderStatus = 'pending';
    const rawStat = String(item.status || '').trim();
    const settlementStat = String(item.settlement_status || '').toUpperCase().trim();

    if (rawStat === '2' || settlementStat === 'SETTLED' || rawStat === 'settled' || rawStat === 'completed') {
      orderStatus = 'approved';
      settledCount++;
    } else if (
      rawStat === '3' ||
      item.fully_refunded === 1 ||
      settlementStat.includes('REFUND') ||
      settlementStat.includes('CANCEL')
    ) {
      orderStatus = 'rejected';
    }

    // Hoàn 50% giá trị sau đối soát kể cả hoa hồng dự kiến cũng báo 50%
    const estimatedCashback = Math.floor(estCommission * cashbackRate);
    const realCashback = orderStatus === 'approved' ? Math.floor(actualCommission * cashbackRate) : 0;
    const finalCommission = (orderStatus === 'approved' && actualCommission > 0) ? actualCommission : estCommission;
    const existing = await db.get('SELECT id, user_id, status FROM tiktok_orders WHERE id = ?', [orderId]);

    let userId = item.user_id || (existing ? existing.user_id : null);
    let clickId = item.click_id || null;

    if (!userId) {
      const matched = await resolveTikTokUser(db, item);
      if (matched) {
        userId = matched.id;
      }
    }

    if (!clickId && (item.trace_id || item.sub2)) {
      clickId = item.trace_id || item.sub2;
    }

    const productName = item.product_name || 'Đơn hàng TikTok Shop';
    const productImage = item.image_url || item.product_image || '';

    if (existing) {
      await db.run(
        `UPDATE tiktok_orders
         SET user_id = COALESCE(?, user_id),
             click_id = COALESCE(?, click_id),
             product_name = COALESCE(NULLIF(?, ''), product_name),
             product_image = COALESCE(NULLIF(?, ''), product_image),
             order_amount = CASE WHEN ? > 0 THEN ? ELSE order_amount END,
             status = ?,
             real_cashback = ?,
             estimated_cashback = ?,
             tiktok_commission = CASE WHEN ? > 0 THEN ? ELSE tiktok_commission END,
             sub_id = COALESCE(NULLIF(?, ''), sub_id),
             notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          userId,
          clickId,
          productName,
          productImage,
          orderAmount,
          orderAmount,
          orderStatus,
          realCashback,
          estimatedCashback,
          finalCommission,
          finalCommission,
          subId,
          `TikTok Shop: ${settlementStat || orderStatus} | SubID: ${subId}`,
          orderId
        ]
      );
      updatedCount++;
    } else {
      await db.run(
        `INSERT INTO tiktok_orders (
          id, user_id, click_id, product_name, product_image,
          order_amount, estimated_cashback, real_cashback, tiktok_commission,
          status, sub_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          userId,
          clickId,
          productName,
          productImage,
          orderAmount,
          estimatedCashback,
          realCashback,
          finalCommission,
          orderStatus,
          subId,
          `TikTok Shop: ${settlementStat || orderStatus} | SubID: ${subId}`
        ]
      );
      importedCount++;
    }

    if (userId) affectedUserIds.add(userId);
  }

  if (affectedUserIds.size > 0) {
    await recalculateUserBalances(db, Array.from(affectedUserIds));
  }

  return {
    importedCount,
    updatedCount,
    settledCount,
    affectedUsersCount: affectedUserIds.size
  };
}

/**
 * Tự động đồng bộ và đối soát đơn TikTok trong nền (Background Cron Job)
 */
async function runAutoSyncTikTokJob() {
  try {
    const db = await getDatabase();
    const settings = await db.get('SELECT riohub_api_key, riohub_creator_username FROM system_settings WHERE id = 1');
    const hasKey = Boolean(process.env.RIOHUB_API_KEY || settings?.riohub_api_key);
    if (!hasKey) return;

    // Lấy các đơn cập nhật trong 24 giờ qua (sync tăng dần theo Unix timestamp)
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 3600);
    const data = await getAffiliateOrders({
      update_time_start: twentyFourHoursAgo,
      page_size: 100
    });

    const orderList = data?.orders || data?.data || [];
    if (orderList.length > 0) {
      const result = await processTikTokOrders(db, orderList);
      if (result.importedCount > 0 || result.updatedCount > 0) {
        console.log(`[TikTok Auto-Sync API] Tự động đồng bộ: +${result.importedCount} mới, ^${result.updatedCount} cập nhật (${result.settledCount} đơn hoàn thành đối soát).`);
      }
    }
  } catch (err) {
    console.warn('[TikTok Auto-Sync API Error]:', err.message);
  }
}

/**
 * 6. Admin lấy danh sách đơn hàng TikTok Shop
 * Route: GET /api/tiktok/admin/orders
 */
async function adminGetTikTokOrders(req, res) {
  const { search, status, page = 1, limit = 10 } = req.query;

  try {
    const db = await getDatabase();
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM tiktok_orders t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as count
      FROM tiktok_orders t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      query += ' AND (t.id LIKE ? OR t.product_name LIKE ? OR t.user_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      countQuery += ' AND (t.id LIKE ? OR t.product_name LIKE ? OR t.user_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      if (status === 'unassigned') {
        query += ' AND (t.user_id IS NULL OR t.user_id = "")';
        countQuery += ' AND (t.user_id IS NULL OR t.user_id = "")';
      } else {
        query += ' AND t.status = ?';
        countQuery += ' AND t.status = ?';
        params.push(status);
        countParams.push(status);
      }
    }

    // Overall stats for TikTok
    const allTikTokOrders = await db.all('SELECT status, order_amount, tiktok_commission, estimated_cashback, real_cashback FROM tiktok_orders');
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalCashback = 0;
    let approvedOrders = 0;

    allTikTokOrders.forEach(o => {
      const cb = Math.floor(o.real_cashback || o.estimated_cashback || 0);
      const comm = Math.floor(o.tiktok_commission || (cb * 2));
      if (o.status === 'approved' || o.status === 'paid') {
        totalRevenue += Math.floor(o.order_amount || 0);
        totalCommission += comm;
        totalCashback += cb;
        approvedOrders++;
      }
    });

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const orders = await db.all(query, params);
    const totalResult = await db.get(countQuery, countParams);
    const total = totalResult ? totalResult.count : 0;

    res.json({
      orders: orders.map(o => ({
        ...o,
        platform: 'tiktok',
        shopee_commission: o.tiktok_commission // For compatibility with frontend order components
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      stats: {
        totalOrders: allTikTokOrders.length,
        approvedOrders,
        totalRevenue,
        totalCommission,
        totalCashback
      }
    });
  } catch (error) {
    console.error('adminGetTikTokOrders Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đơn hàng TikTok' });
  }
}

/**
 * 7. Admin cập nhật trạng thái đơn hàng TikTok Shop
 * Route: PUT /api/tiktok/admin/orders/:id/status
 */
async function adminUpdateTikTokOrderStatus(req, res) {
  const { id } = req.params;
  const { status, realCashback, notes, userId } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Trạng thái là bắt buộc' });
  }

  try {
    const db = await getDatabase();
    const order = await db.get('SELECT * FROM tiktok_orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng TikTok' });
    }

    let targetUserId = order.user_id;
    if (userId !== undefined) {
      if (userId === null || String(userId).trim() === '') {
        targetUserId = null;
      } else if (String(userId).trim().includes('@')) {
        const foundUser = await db.get('SELECT id FROM users WHERE email = ?', [String(userId).trim()]);
        if (foundUser) targetUserId = foundUser.id;
        else targetUserId = String(userId).trim();
      } else {
        targetUserId = String(userId).trim();
      }
    }

    let finalRealCash = realCashback !== undefined && realCashback !== '' ? Math.floor(Number(realCashback)) : undefined;
    if (finalRealCash === undefined && (status === 'approved' || status === 'paid')) {
      const comm = Number(order.tiktok_commission || 0);
      finalRealCash = comm > 0 ? Math.floor(comm * 0.5) : Math.floor(order.estimated_cashback || 0);
    } else if (finalRealCash === undefined) {
      finalRealCash = 0;
    }

    await db.run(
      `UPDATE tiktok_orders
       SET status = ?, real_cashback = ?, notes = ?, user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, finalRealCash, notes !== undefined ? notes : order.notes, targetUserId, id]
    );

    // Gửi thông báo cho User nếu đơn có gán User
    if (targetUserId) {
      const notifId = `NT${Date.now()}`;
      let title = status === 'approved' ? 'Đơn TikTok Shop hoàn thành' : (status === 'rejected' ? 'Đơn TikTok Shop bị từ chối' : 'Cập nhật đơn TikTok');
      await db.run(
        `INSERT INTO notifications (id, user_id, title, content, type)
         VALUES (?, ?, ?, ?, 'order')`,
        [notifId, targetUserId, title, `Đơn hàng TikTok ${id} (${(order.product_name || '').substring(0, 25)}...) đã được cập nhật trạng thái: ${status}.`]
      ).catch(() => {});

      if ((status === 'approved' || status === 'paid') && order.status !== 'approved' && order.status !== 'paid') {
        const userObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [targetUserId]);
        if (userObj && userObj.referred_by) {
          const refBonus = Math.floor(finalRealCash * 0.20);
          if (refBonus > 0) {
            const refNotifId = `NT${Date.now()}${Math.floor(Math.random() * 100)}`;
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, 'Hoa hồng giới thiệu', ?, 'system')`,
              [refNotifId, userObj.referred_by, `Bạn nhận được +${refBonus.toLocaleString('vi-VN')}đ hoa hồng từ đơn TikTok hoàn thành của người bạn giới thiệu.`]
            ).catch(() => {});
          }
        }
      }
    }

    await recalculateUserBalances(db, [targetUserId, order.user_id].filter(Boolean));
    res.json({ message: 'Đã cập nhật trạng thái đơn TikTok thành công' });
  } catch (error) {
    console.error('adminUpdateTikTokOrderStatus Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật đơn TikTok' });
  }
}

/**
 * 8. Admin tạo đơn TikTok Shop thủ công
 * Route: POST /api/tiktok/admin/orders
 */
async function adminCreateTikTokOrder(req, res) {
  const { id, userId, productName, productImage, orderAmount, estimatedCashback, realCashback, tiktokCommission, status = 'pending', notes } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập tên sản phẩm' });
  }

  try {
    const db = await getDatabase();
    const orderId = (id && String(id).trim()) ? String(id).trim() : (`TT${Date.now()}${Math.floor(100 + Math.random() * 900)}`);
    const finalAmount = Math.max(0, Math.floor(Number(orderAmount) || 0));
    let finalComm = tiktokCommission ? Math.max(0, Math.floor(Number(tiktokCommission))) : 0;
    
    // Tự động tính 50% nếu chưa có estimatedCashback
    const finalEstimatedCashback = (estimatedCashback !== undefined && estimatedCashback !== '' && Number(estimatedCashback) > 0)
      ? Math.max(0, Math.floor(Number(estimatedCashback)))
      : (finalComm > 0 ? Math.floor(finalComm * 0.5) : 0);

    const finalRealCashback = (realCashback !== undefined && realCashback !== null && realCashback !== '' && Number(realCashback) >= 0)
      ? Math.max(0, Math.floor(Number(realCashback)))
      : ((status === 'approved' || status === 'paid') ? (finalComm > 0 ? Math.floor(finalComm * 0.5) : finalEstimatedCashback) : 0);

    if (finalComm <= 0 && finalEstimatedCashback > 0) {
      finalComm = finalEstimatedCashback * 2;
    }

    let targetUserId = userId || null;
    if (targetUserId && targetUserId.includes('@')) {
      const u = await db.get('SELECT id FROM users WHERE email = ?', [targetUserId]);
      if (u) targetUserId = u.id;
    }

    await db.run(
      `INSERT INTO tiktok_orders (id, user_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, tiktok_commission, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, targetUserId, productName, productImage || '', finalAmount, finalEstimatedCashback, finalRealCashback, finalComm, status, notes || 'Tạo thủ công bởi Admin']
    );

    if (targetUserId) {
      await recalculateUserBalances(db, [targetUserId]);
    }

    res.status(201).json({ message: 'Đã tạo đơn TikTok thành công', id: orderId });
  } catch (error) {
    console.error('adminCreateTikTokOrder Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo đơn TikTok' });
  }
}

/**
 * 9. Admin xóa đơn TikTok Shop
 * Route: DELETE /api/tiktok/admin/orders/:id
 */
async function adminDeleteTikTokOrder(req, res) {
  const { id } = req.params;
  try {
    const db = await getDatabase();
    const order = await db.get('SELECT * FROM tiktok_orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng TikTok' });

    await db.run('DELETE FROM tiktok_orders WHERE id = ?', [id]);
    if (order.user_id) {
      await recalculateUserBalances(db, [order.user_id]);
    }
    res.json({ message: 'Đã xóa đơn hàng TikTok thành công' });
  } catch (error) {
    console.error('adminDeleteTikTokOrder Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa đơn TikTok' });
  }
}

/**
 * 10. Admin xóa hàng loạt đơn TikTok
 * Route: DELETE /api/tiktok/admin/orders/clear-all
 */
async function adminClearAllTikTokOrders(req, res) {
  const { onlyUnassigned } = req.body || {};
  try {
    const db = await getDatabase();
    if (onlyUnassigned) {
      const result = await db.run('DELETE FROM tiktok_orders WHERE user_id IS NULL OR user_id = ""');
      return res.json({ message: `Đã xóa ${result.changes || 0} đơn TikTok chưa gán thành viên` });
    } else {
      await db.run('DELETE FROM tiktok_orders');
      await recalculateUserBalances(db);
      return res.json({ message: 'Đã xóa toàn bộ đơn hàng TikTok và đồng bộ lại ví' });
    }
  } catch (error) {
    console.error('adminClearAllTikTokOrders Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa đơn TikTok' });
  }
}

module.exports = {
  convertTikTokLink,
  getTikTokProductInfo,
  createTikTokGeneralLinks,
  handleTikTokWebhook,
  syncTikTokOrders,
  processTikTokOrders,
  runAutoSyncTikTokJob,
  adminQueryRiohubOrders,
  adminGetTikTokOrders,
  adminUpdateTikTokOrderStatus,
  adminCreateTikTokOrder,
  adminDeleteTikTokOrder,
  adminClearAllTikTokOrders
};
