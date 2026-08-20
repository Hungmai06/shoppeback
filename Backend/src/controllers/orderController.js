const { getDatabase } = require('../config/db');
const { extractShopeeIds } = require('../services/affiliateMatchingService');

async function createOrder(req, res) {
  const { id, productName, productImage, orderAmount, estimatedCashback, clickId } = req.body;
  const userId = req.user ? req.user.id : null;
  const finalId = id || clickId || `CLK${Date.now()}`;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    const db = await getDatabase();
    if (userId) {
      await db.run(
        `INSERT OR REPLACE INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
        [
          finalId,
          userId,
          clickId || finalId,
          productName || 'Sản phẩm Shopee',
          productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400',
          Number(orderAmount || 0),
          Number(estimatedCashback || 0),
          Number(estimatedCashback ? estimatedCashback * 2 : 0),
          now
        ]
      );
    }

    res.status(201).json({ message: 'Đã lưu đơn hàng chờ đối soát thành công', id: finalId });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo đơn hàng' });
  }
}

async function logClick(req, res) {
  const { productUrl, productName, productImage, orderAmount, estimatedCashback } = req.body;

  if (!productUrl) {
    return res.status(400).json({ message: 'Thiếu đường dẫn sản phẩm' });
  }

  try {
    const db = await getDatabase();
    const clickId = `CLK${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
    const subId = clickId;
    const extracted = extractShopeeIds(productUrl);
    const itemId = req.body.itemId || req.body.item_id || extracted.itemId || null;
    const shopId = req.body.shopId || req.body.shop_id || extracted.shopId || null;
    const clickedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const userId = req.user ? req.user.id : null;

    await db.run(
      `INSERT INTO affiliate_clicks (id, user_id, click_id, sub_id, item_id, shop_id, origin_url, clicked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clickId, userId, clickId, subId, itemId, shopId, productUrl, clickedAt]
    );

    await db.run(
      'INSERT INTO click_logs (id, user_id, product_url, sub_id) VALUES (?, ?, ?, ?)',
      [clickId, userId, productUrl, subId]
    );

    // Ghi nhận vào orders nếu user đã đăng nhập
    if (userId) {
      const finalName = productName || 'Sản phẩm Shopee';
      const finalImg = productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400';
      const finalAmount = Number(orderAmount || 0);
      const finalCb = Number(estimatedCashback || Math.round(finalAmount * 0.035));

      await db.run(
        `INSERT OR REPLACE INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
        [clickId, userId, clickId, finalName, finalImg, finalAmount, finalCb, finalCb * 2, clickedAt]
      );
    }

    res.status(201).json({ message: 'Đã ghi nhận lượt click mua hàng', clickId, subId, itemId, shopId });
  } catch (error) {
    console.error('Log Click Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi ghi nhận click' });
  }
}

async function getUserOrders(req, res) {
  const { search, status } = req.query;

  try {
    const db = await getDatabase();

    // Tự động đồng bộ các đơn affiliate của user sang orders nếu chưa có
    try {
      const unsyncedUser = await db.all(
        `SELECT a.* FROM affiliate_orders a
         LEFT JOIN orders o ON a.order_id = o.id
         WHERE o.id IS NULL AND a.user_id = ?`,
        [req.user.id]
      );
      if (unsyncedUser && unsyncedUser.length > 0) {
        const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
        const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;
        for (const un of unsyncedUser) {
          const cb = Math.round((un.commission || 0) * cashbackRate);
          const st = un.shopee_status ? (un.shopee_status.toLowerCase().includes('hoàn thành') || un.shopee_status.toLowerCase().includes('approved') ? 'approved' : 'pending') : 'pending';
          await db.run(
            `INSERT OR IGNORE INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              un.order_id, un.user_id, un.matched_click_id, un.product_name || 'Sản phẩm Shopee',
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200',
              un.order_amount || 0, cb, cb, un.commission || 0, st,
              un.order_time || new Date().toISOString().replace('T', ' ').substring(0, 19)
            ]
          );
        }
      }
    } catch (e) { }
    
    let query = 'SELECT * FROM orders WHERE user_id = ?';
    const params = [req.user.id];

    if (search) {
      query += ' AND (id LIKE ? OR product_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const orders = await db.all(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Get User Orders Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đơn hàng' });
  }
}

async function adminGetOrders(req, res) {
  const { search, status, page = 1, limit = 10 } = req.query;

  try {
    const db = await getDatabase();

    // Tự động đồng bộ các đơn affiliate sang orders nếu chưa có để đảm bảo Dashboard luôn hiển thị đầy đủ
    try {
      const unsynced = await db.all(
        `SELECT a.* FROM affiliate_orders a
         LEFT JOIN orders o ON a.order_id = o.id
         WHERE o.id IS NULL`
      );
      if (unsynced && unsynced.length > 0) {
        const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
        const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;
        for (const un of unsynced) {
          const cb = Math.round((un.commission || 0) * cashbackRate);
          let st = 'pending';
          if (un.shopee_status) {
            const rawSt = un.shopee_status.toLowerCase();
            if (rawSt.includes('hoàn thành') || rawSt.includes('approved') || rawSt.includes('paid')) st = 'approved';
            else if (rawSt.includes('hủy') || rawSt.includes('rejected') || rawSt.includes('cancelled')) st = 'rejected';
            else if (rawSt.includes('hoàn hàng') || rawSt.includes('returned')) st = 'returned';
          }
          await db.run(
            `INSERT OR IGNORE INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              un.order_id, un.user_id, un.matched_click_id, un.product_name || 'Sản phẩm Shopee',
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200',
              un.order_amount || 0, cb, cb, un.commission || 0, st,
              un.order_time || new Date().toISOString().replace('T', ' ').substring(0, 19)
            ]
          );
        }
      }
    } catch (e) { }

    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM orders WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM orders WHERE 1=1';
    const params = [];
    const countParams = [];

    if (search) {
      const searchParam = `%${search}%`;
      query += ' AND (id LIKE ? OR product_name LIKE ? OR user_id LIKE ?)';
      countQuery += ' AND (id LIKE ? OR product_name LIKE ? OR user_id LIKE ?)';
      params.push(searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = await db.all(query, params);
    const totalCountResult = await db.get(countQuery, countParams);
    const total = totalCountResult.count;

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin Get Orders Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy đơn hàng quản trị' });
  }
}

async function adminUpdateOrderStatus(req, res) {
  const { id } = req.params;
  const { status, realCashback, notes } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Trạng thái đơn hàng là bắt buộc' });
  }

  try {
    const db = await getDatabase();
    
    // Check if order exists
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Set realCashback if not specified and status changes to approved
    let finalRealCash = realCashback;
    if (finalRealCash === undefined && (status === 'approved' || status === 'paid')) {
      finalRealCash = order.estimated_cashback;
    }

    const updatedRealCashback = finalRealCash !== undefined ? finalRealCash : order.real_cashback;
    const updatedNotes = notes !== undefined ? notes : order.notes;

    await db.run('BEGIN TRANSACTION');

    await db.run(
      `UPDATE orders
       SET status = ?,
           real_cashback = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, updatedRealCashback, updatedNotes, id]
    );

    // Update user balance if transitioning to approved
    if (status === 'approved' && order.status !== 'approved' && order.user_id) {
      const userCashback = updatedRealCashback;
      
      await db.run(
        `UPDATE users 
         SET balance = COALESCE(balance, 0) + ?,
             total_cashback = COALESCE(total_cashback, 0) + ?
         WHERE id = ?`,
        [userCashback, userCashback, order.user_id]
      );

      // Check for referral bonus (20%)
      const currentUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [order.user_id]);
      if (currentUserObj && currentUserObj.referred_by) {
        const refBonus = userCashback * 0.20;
        await db.run(
          `UPDATE users 
           SET balance = COALESCE(balance, 0) + ?,
               referral_earnings = COALESCE(referral_earnings, 0) + ?
           WHERE id = ?`,
          [refBonus, refBonus, currentUserObj.referred_by]
        );
        
        const refNotifId = `NT${Date.now()}${Math.floor(Math.random()*100)}`;
        await db.run(
          `INSERT INTO notifications (id, user_id, title, content, type)
           VALUES (?, ?, 'Hoa hồng giới thiệu', ?, 'system')`,
          [refNotifId, currentUserObj.referred_by, `Bạn nhận được +${Math.round(refBonus).toLocaleString('vi-VN')}đ hoa hồng từ giao dịch của người bạn giới thiệu.`]
        );
      }
    }

    // Create user notification
    let statusVietnamese = '';
    if (status === 'approved') statusVietnamese = 'hoàn thành';
    if (status === 'rejected') statusVietnamese = 'đã bị hủy';
    if (status === 'returned') statusVietnamese = 'đã hoàn hàng';
    if (status === 'paid') statusVietnamese = 'đã thanh toán';

    if (statusVietnamese) {
      const notifId = `NT${Date.now()}`;
      let title = '';
      if (status === 'approved') title = 'Đơn hàng hoàn thành';
      else if (status === 'paid') title = 'Đơn hàng đã thanh toán';
      else if (status === 'returned') title = 'Đơn hàng đã hoàn hàng';
      else title = 'Đơn hàng bị hủy';

      await db.run(
        `INSERT INTO notifications (id, user_id, title, content, type)
         VALUES (?, ?, ?, ?, 'order')`,
        [
          notifId,
          order.user_id,
          title,
          `Đơn hàng ${id} (${order.product_name.substring(0, 25)}...) ${statusVietnamese}.`
        ]
      );
    }

    await db.run('COMMIT');

    res.json({ message: `Đã cập nhật trạng thái đơn hàng sang ${status} thành công` });
  } catch (error) {
    const db = await getDatabase();
    await db.run('ROLLBACK');
    console.error('Admin Update Order Status Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật đơn hàng' });
  }
}

module.exports = {
  createOrder,
  logClick,
  getUserOrders,
  adminGetOrders,
  adminUpdateOrderStatus
};
