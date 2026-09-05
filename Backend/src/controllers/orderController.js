const { getDatabase } = require('../config/db');

async function logClick(req, res) {
  const { productUrl } = req.body;

  if (!productUrl) {
    return res.status(400).json({ message: 'Thiếu đường dẫn sản phẩm' });
  }

  try {
    const db = await getDatabase();
    const clickId = `CLK${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

    await db.run(
      'INSERT INTO click_logs (id, user_id, product_url) VALUES (?, ?, ?)',
      [clickId, req.user.id, productUrl]
    );

    res.status(201).json({ message: 'Đã ghi nhận lượt click mua hàng', clickId });
  } catch (error) {
    console.error('Log Click Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi ghi nhận click' });
  }
}

async function getUserOrders(req, res) {
  const { search, status } = req.query;

  try {
    const db = await getDatabase();
    
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

async function updateOrderScreenshot(req, res) {
  const { id } = req.params;
  const { screenshot } = req.body;

  if (!screenshot) {
    return res.status(400).json({ message: 'Thiếu đường dẫn ảnh chụp minh chứng' });
  }

  try {
    const db = await getDatabase();
    await db.run('UPDATE orders SET screenshot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [screenshot, id]);
    res.json({ message: 'Đã cập nhật ảnh minh chứng đơn hàng thành công' });
  } catch (error) {
    console.error('Update Screenshot Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lưu ảnh minh chứng' });
  }
}

module.exports = {
  logClick,
  getUserOrders,
  adminGetOrders,
  adminUpdateOrderStatus,
  updateOrderScreenshot
};
