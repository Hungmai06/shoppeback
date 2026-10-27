const { getDatabase } = require('../config/db');
const { recalculateUserBalances } = require('../services/balanceService');
const { extractShopeeIds } = require('../services/shopeeService');

async function logClick(req, res) {
  const { id, clickId: customClickId, productUrl, productName, productImage, orderAmount, estimatedCashback, userId: bodyUserId, shopId: bodyShopId, itemId: bodyItemId } = req.body;

  if (!productUrl && !productName) {
    return res.status(400).json({ message: 'Thiếu đường dẫn sản phẩm' });
  }

  try {
    const db = await getDatabase();
    const clickId = id || customClickId || req.body.clickId || ('CLK' + Date.now() + Math.floor(100 + Math.random() * 900));
    const userId = req.user ? req.user.id : (bodyUserId || req.body.userId || null);

    // Extract shopId and itemId from productUrl or productName
    const idsFromUrl = extractShopeeIds(productUrl || productName || '');
    const finalShopId = (bodyShopId || idsFromUrl.shopId || '') || null;
    const finalItemId = (bodyItemId || idsFromUrl.itemId || '') || null;

    try {
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url, shop_id, item_id) VALUES (?, ?, ?, ?, ?)',
        [clickId, userId, productUrl || productName, finalShopId, finalItemId]
      );
    } catch (cErr) {
      // Ignored if already logged
    }

    // Save pending order to orders table so user and admin can see and manage it
    const name = productName || productUrl;
    const img = productImage || '';
    const amount = Math.floor(Number(orderAmount) || 100000);
    const cashback = Number(estimatedCashback) ? Math.floor(Number(estimatedCashback)) : Math.floor(amount * 0.035);

    try {
      await db.run(
        `INSERT INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, status, shop_id, item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [clickId, userId, clickId, name, img, amount, cashback, finalShopId, finalItemId]
      );
    } catch (oErr) {
      console.warn('Order insertion warning on click:', oErr.message);
    }

    res.status(201).json({ message: 'Đã ghi nhận lượt click mua hàng', clickId, shopId: finalShopId, itemId: finalItemId });
  } catch (error) {
    console.error('Log Click Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi ghi nhận click' });
  }
}

async function getUserOrders(req, res) {
  const { search, status, platform } = req.query;

  try {
    const db = await getDatabase();
    
    // 1. Shopee Orders query
    let shopeeQuery = `
      SELECT id, user_id, click_id, product_name, product_image, order_amount,
             estimated_cashback, real_cashback, shopee_commission, status,
             screenshot, notes, created_at, updated_at, 'shopee' as platform
      FROM orders
      WHERE user_id = ?
    `;
    const shopeeParams = [req.user.id];

    if (search) {
      shopeeQuery += ' AND (id LIKE ? OR product_name LIKE ?)';
      shopeeParams.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      shopeeQuery += ' AND status = ?';
      shopeeParams.push(status);
    }

    // 2. TikTok Orders query
    let tiktokQuery = `
      SELECT id, user_id, click_id, product_name, product_image, order_amount,
             estimated_cashback, real_cashback, tiktok_commission as shopee_commission, status,
             screenshot, notes, created_at, updated_at, 'tiktok' as platform
      FROM tiktok_orders
      WHERE user_id = ?
    `;
    const tiktokParams = [req.user.id];

    if (search) {
      tiktokQuery += ' AND (id LIKE ? OR product_name LIKE ?)';
      tiktokParams.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      tiktokQuery += ' AND status = ?';
      tiktokParams.push(status);
    }

    let allOrders = [];
    if (!platform || platform === 'all') {
      const [shopeeList, tiktokList] = await Promise.all([
        db.all(shopeeQuery, shopeeParams),
        db.all(tiktokQuery, tiktokParams)
      ]);
      allOrders = [...shopeeList, ...tiktokList];
    } else if (platform === 'shopee') {
      allOrders = await db.all(shopeeQuery, shopeeParams);
    } else if (platform === 'tiktok') {
      allOrders = await db.all(tiktokQuery, tiktokParams);
    }

    // Sort combined orders by created_at DESC
    allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(allOrders);
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

    let query = `
      SELECT o.*, u.name as user_name, u.email as user_email 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const searchParam = `%${search}%`;
      const sLower = search.toLowerCase();
      let userNullCondition = '';
      if (sLower.includes('chưa xác định') || sLower.includes('chua xac dinh') || sLower.includes('chưa gán') || sLower.includes('unassigned') || sLower === 'null') {
        userNullCondition = ' OR o.user_id IS NULL';
      }
      query += ` AND (o.id LIKE ? OR o.product_name LIKE ? OR o.user_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?${userNullCondition})`;
      countQuery += ` AND (o.id LIKE ? OR o.product_name LIKE ? OR o.user_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?${userNullCondition})`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    if (status && status !== 'all') {
      if (status === 'unassigned') {
        query += ' AND o.user_id IS NULL';
        countQuery += ' AND o.user_id IS NULL';
      } else {
        query += ' AND o.status = ?';
        countQuery += ' AND o.status = ?';
        params.push(status);
        countParams.push(status);
      }
    }

    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
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
  const { status, realCashback, notes, userId } = req.body;

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

    // Determine target user ID (allow admin to reassign order to another user or unassign)
    let targetUserId = order.user_id;
    if (userId !== undefined) {
      if (userId === null || String(userId).trim() === '') {
        targetUserId = null; // Explicit unassignment by admin
      } else if (String(userId).trim().includes('@')) {
        const foundUser = await db.get('SELECT id FROM users WHERE email = ?', [String(userId).trim()]);
        if (foundUser) targetUserId = foundUser.id;
        else targetUserId = String(userId).trim();
      } else {
        targetUserId = String(userId).trim();
      }
    }

    // Set realCashback if not specified and status changes to approved
    let finalRealCash = realCashback !== undefined && realCashback !== '' ? Math.floor(Number(realCashback)) : undefined;
    if (finalRealCash === undefined && (status === 'approved' || status === 'paid')) {
      finalRealCash = Math.floor(order.estimated_cashback || 0);
    }

    const updatedRealCashback = finalRealCash !== undefined ? Math.floor(finalRealCash) : (order.real_cashback !== null && order.real_cashback !== undefined ? Math.floor(order.real_cashback) : null);
    const updatedNotes = notes !== undefined ? notes : order.notes;

    await db.run('BEGIN TRANSACTION');

    await db.run(
      `UPDATE orders
       SET status = ?,
           user_id = ?,
           real_cashback = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, targetUserId, updatedRealCashback, updatedNotes, id]
    );

    // Handle user balance update logic
    const wasApproved = order.status === 'approved';
    const isNowApproved = status === 'approved';
    const oldUserId = order.user_id;
    const oldCashback = order.real_cashback !== null && order.real_cashback !== undefined ? Math.floor(order.real_cashback) : Math.floor(order.estimated_cashback || 0);

    // 1. If order was approved for oldUserId, but is now NOT approved OR targetUserId changed (or became null):
    if (wasApproved && oldUserId && (!isNowApproved || targetUserId !== oldUserId)) {
      await db.run(
        `UPDATE users 
         SET balance = CASE WHEN COALESCE(balance, 0) >= ? THEN balance - ? ELSE 0 END,
             total_cashback = CASE WHEN COALESCE(total_cashback, 0) >= ? THEN total_cashback - ? ELSE 0 END
         WHERE id = ?`,
        [oldCashback, oldCashback, oldCashback, oldCashback, oldUserId]
      );

      // Deduct referral bonus if old user had a referrer
      const oldUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [oldUserId]);
      if (oldUserObj && oldUserObj.referred_by) {
        const refBonus = Math.floor(oldCashback * 0.20);
        await db.run(
          `UPDATE users 
           SET balance = CASE WHEN COALESCE(balance, 0) >= ? THEN balance - ? ELSE 0 END,
               referral_earnings = CASE WHEN COALESCE(referral_earnings, 0) >= ? THEN referral_earnings - ? ELSE 0 END
           WHERE id = ?`,
          [refBonus, refBonus, refBonus, refBonus, oldUserObj.referred_by]
        );
      }
    }

    // 2. If order is approved (now or previously), and assigned/reassigned to targetUserId
    if (isNowApproved && targetUserId) {
      if (!wasApproved || !oldUserId || oldUserId !== targetUserId) {
        // Credit new targetUserId
        const userCashback = Math.floor(updatedRealCashback);
        await db.run(
          `UPDATE users 
           SET balance = COALESCE(balance, 0) + ?,
               total_cashback = COALESCE(total_cashback, 0) + ?
           WHERE id = ?`,
          [userCashback, userCashback, targetUserId]
        );

        // Check for referral bonus (20%)
        const currentUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [targetUserId]);
        if (currentUserObj && currentUserObj.referred_by) {
          const refBonus = Math.floor(userCashback * 0.20);
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
            [refNotifId, currentUserObj.referred_by, `Bạn nhận được +${refBonus.toLocaleString('vi-VN')}đ hoa hồng từ giao dịch của người bạn giới thiệu.`]
          );
        }
      } else if (wasApproved && oldUserId === targetUserId) {
        // Same user, check if cashback amount changed
        const diff = Math.floor(updatedRealCashback) - Math.floor(oldCashback);
        if (diff !== 0) {
          await db.run(
            `UPDATE users 
             SET balance = CASE WHEN (COALESCE(balance, 0) + ?) >= 0 THEN (COALESCE(balance, 0) + ?) ELSE 0 END,
                 total_cashback = CASE WHEN (COALESCE(total_cashback, 0) + ?) >= 0 THEN (COALESCE(total_cashback, 0) + ?) ELSE 0 END
             WHERE id = ?`,
            [diff, diff, diff, diff, targetUserId]
          );
        }
      }
    }

    // Create user notification if user exists
    if (targetUserId) {
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
            targetUserId,
            title,
            `Đơn hàng ${id} (${order.product_name.substring(0, 25)}...) ${statusVietnamese}.`
          ]
        );
      }
    }

    // Tự động đồng bộ chuẩn số dư của người dùng bị ảnh hưởng
    await recalculateUserBalances(db, [targetUserId, oldUserId].filter(Boolean));

    await db.run('COMMIT');

    res.json({ message: `Đã cập nhật đơn hàng thành công` });
  } catch (error) {
    const db = await getDatabase();
    await db.run('ROLLBACK');
    console.error('Admin Update Order Status Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật đơn hàng' });
  }
}

async function adminDeleteOrder(req, res) {
  const { id } = req.params;

  try {
    const db = await getDatabase();
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng để xóa' });
    }

    await db.run('DELETE FROM orders WHERE id = ?', [id]);
    if (order.user_id) {
      await recalculateUserBalances(db, [order.user_id]);
    }
    res.json({ message: 'Đã xóa đơn hàng thành công' });
  } catch (error) {
    console.error('Admin Delete Order Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa đơn hàng' });
  }
}

async function adminClearAllOrders(req, res) {
  const { type } = req.query; // 'all', 'unassigned', or 'full-clean'

  try {
    const db = await getDatabase();
    if (type === 'unassigned') {
      const result = await db.run('DELETE FROM orders WHERE user_id IS NULL OR user_id = ""');
      return res.json({ message: `Đã xóa ${result.changes || 0} đơn hàng chưa xác định thành công` });
    }

    await db.run('DELETE FROM orders');
    await db.run('DELETE FROM click_logs');
    await db.run('DELETE FROM withdrawals');
    await db.run('DELETE FROM notifications');
    await db.run('DELETE FROM reconciliation_logs');
    await db.run('UPDATE users SET balance = 0, total_cashback = 0, pending_cashback = 0');

    res.json({ message: 'Đã xóa sạch dữ liệu đơn hàng, lượt click, rút tiền và reset ví thành viên về 0đ thành công!' });
  } catch (error) {
    console.error('Admin Clear All Orders Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa dữ liệu đơn hàng' });
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
    const result = await db.run('UPDATE orders SET screenshot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [screenshot, id]);
    if (!result || result.changes === 0) {
      await db.run('UPDATE tiktok_orders SET screenshot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [screenshot, id]);
    }
    res.json({ message: 'Đã cập nhật ảnh minh chứng đơn hàng thành công' });
  } catch (error) {
    console.error('Update Screenshot Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lưu ảnh minh chứng' });
  }
}

async function adminCreateOrder(req, res) {
  const {
    id,
    userId,
    productName,
    productImage,
    orderAmount,
    estimatedCashback,
    realCashback,
    shopeeCommission,
    status = 'pending',
    shopId,
    itemId,
    notes
  } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập tên sản phẩm' });
  }

  const orderId = (id && String(id).trim()) ? String(id).trim() : (`ORD${Date.now()}${Math.floor(100 + Math.random() * 900)}`);
  const finalAmount = Math.max(0, Math.floor(Number(orderAmount) || 0));
  const finalEstimatedCashback = Math.max(0, Math.floor(Number(estimatedCashback) || 0));
  const finalRealCashback = realCashback !== undefined && realCashback !== null && realCashback !== '' 
    ? Math.max(0, Math.floor(Number(realCashback))) 
    : (status === 'approved' || status === 'paid' ? finalEstimatedCashback : 0);
  const finalShopeeCommission = shopeeCommission ? Math.max(0, Math.floor(Number(shopeeCommission))) : 0;
  const targetUserId = (userId && String(userId).trim()) ? String(userId).trim() : null;
  const cleanShopId = shopId ? String(shopId).trim() : null;
  const cleanItemId = itemId ? String(itemId).trim() : null;

  try {
    const db = await getDatabase();

    // Check if orderId already exists
    const existing = await db.get('SELECT id FROM orders WHERE id = ?', [orderId]);
    if (existing) {
      return res.status(400).json({ message: `Mã đơn hàng "${orderId}" đã tồn tại trong hệ thống` });
    }

    // Verify user exists if provided
    if (targetUserId) {
      const user = await db.get('SELECT id FROM users WHERE id = ?', [targetUserId]);
      if (!user) {
        return res.status(400).json({ message: `Không tìm thấy thành viên với ID "${targetUserId}"` });
      }
    }

    await db.run(
      `INSERT INTO orders (id, user_id, click_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, shopee_commission, status, shop_id, item_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        orderId,
        targetUserId,
        orderId,
        productName.trim(),
        productImage || '',
        finalAmount,
        finalEstimatedCashback,
        finalRealCashback,
        finalShopeeCommission,
        status,
        cleanShopId,
        cleanItemId,
        notes || null
      ]
    );

    // If created directly as approved, credit user balance & recalculate
    if (targetUserId && (status === 'approved' || status === 'paid')) {
      await recalculateUserBalances(db, [targetUserId]);

      // Check referral bonus (20%)
      const currentUserObj = await db.get('SELECT referred_by FROM users WHERE id = ?', [targetUserId]);
      if (currentUserObj && currentUserObj.referred_by && finalRealCashback > 0) {
        const refBonus = Math.floor(finalRealCashback * 0.20);
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
          [refNotifId, currentUserObj.referred_by, `Bạn nhận được +${refBonus.toLocaleString('vi-VN')}đ hoa hồng từ đơn hàng của người bạn giới thiệu.`]
        );
      }

      // Notification to user
      const notifId = `NT${Date.now()}`;
      await db.run(
        `INSERT INTO notifications (id, user_id, title, content, type)
         VALUES (?, ?, 'Đơn hàng mới được tạo', ?, 'order')`,
        [notifId, targetUserId, `Đơn hàng ${orderId} (${productName.substring(0, 25)}...) đã được quản trị viên tạo và ghi nhận thành công. Tiền hoàn: +${finalRealCashback.toLocaleString('vi-VN')}đ.`]
      );
    } else if (targetUserId) {
      await recalculateUserBalances(db, [targetUserId]);
    }

    res.status(201).json({
      message: 'Tạo đơn hàng mới thành công',
      order: {
        id: orderId,
        userId: targetUserId,
        productName,
        orderAmount: finalAmount,
        estimatedCashback: finalEstimatedCashback,
        realCashback: finalRealCashback,
        status
      }
    });
  } catch (error) {
    console.error('Admin Create Order Error:', error);
    res.status(500).json({ message: error.message || 'Lỗi máy chủ khi tạo đơn hàng' });
  }
}

module.exports = {
  logClick,
  getUserOrders,
  adminGetOrders,
  adminCreateOrder,
  adminUpdateOrderStatus,
  adminDeleteOrder,
  adminClearAllOrders,
  updateOrderScreenshot
};
