const { getDatabase } = require('../config/db');
const { recalculateUserBalances } = require('../services/balanceService');

/**
 * 1. Thống kê hoa hồng giới thiệu
 * GET /api/referrals/stats
 */
exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDatabase();

    // Đồng bộ chuẩn số dư và hoa hồng giới thiệu ngay lập tức
    await recalculateUserBalances(db, [userId]);

    // Lấy thông tin user hiện tại
    const user = await db.get(`SELECT id, referral_earnings, COALESCE(referral_clicks, 0) as referral_clicks FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Lấy danh sách F1 ids
    const f1Users = await db.all(`SELECT id FROM users WHERE referred_by = ?`, [userId]);
    const f1Count = f1Users.length;
    const f1Ids = f1Users.map(u => u.id);

    let pendingCommission = 0;
    let approvedCommission = 0;
    let pendingOrdersCount = 0;
    let completedOrdersCount = 0;
    let totalOrdersCount = 0;

    if (f1Ids.length > 0) {
      const placeholders = f1Ids.map(() => '?').join(',');
      const [shopeeOrders, tiktokOrders] = await Promise.all([
        db.all(`
          SELECT status, estimated_cashback, real_cashback 
          FROM orders 
          WHERE user_id IN (${placeholders})
        `, f1Ids),
        db.all(`
          SELECT status, estimated_cashback, real_cashback 
          FROM tiktok_orders 
          WHERE user_id IN (${placeholders})
        `, f1Ids)
      ]);

      const allOrders = [...shopeeOrders, ...tiktokOrders];
      totalOrdersCount = allOrders.length;

      allOrders.forEach(order => {
        const baseCashback = Math.floor(order.real_cashback || order.estimated_cashback || 0);
        const bonus = Math.floor(baseCashback * 0.2);

        if (order.status === 'approved' || order.status === 'paid') {
          approvedCommission += bonus;
          completedOrdersCount++;
        } else if (order.status === 'pending' || order.status === 'processing') {
          pendingCommission += bonus;
          pendingOrdersCount++;
        }
      });
    }

    res.json({
      clicks: user.referral_clicks || 0,
      f1Count,
      f2Count: 0,
      pendingCommission: Math.floor(pendingCommission),
      approvedCommission: Math.floor(approvedCommission),
      totalCommission: Math.floor(pendingCommission + approvedCommission),
      pendingOrdersCount,
      completedOrdersCount,
      totalOrdersCount
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê giới thiệu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * 2. Lịch sử hoa hồng giới thiệu từ các đơn hàng F1
 * GET /api/referrals/history
 */
exports.getReferralHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDatabase();

    // Lấy danh sách F1 ids
    const f1Users = await db.all(`SELECT id, name, email FROM users WHERE referred_by = ?`, [userId]);
    if (f1Users.length === 0) {
      return res.json([]);
    }

    const f1Map = {};
    f1Users.forEach(u => {
      f1Map[u.id] = { name: u.name, email: u.email };
    });
    const f1Ids = Object.keys(f1Map);
    const placeholders = f1Ids.map(() => '?').join(',');

    // Lấy tất cả đơn hàng của F1 từ cả Shopee và TikTok
    const [shopeeOrders, tiktokOrders] = await Promise.all([
      db.all(`
        SELECT id, user_id, product_name, product_image, order_amount, status, estimated_cashback, real_cashback, created_at, 'shopee' as platform
        FROM orders 
        WHERE user_id IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT 200
      `, f1Ids),
      db.all(`
        SELECT id, user_id, product_name, product_image, order_amount, status, estimated_cashback, real_cashback, created_at, 'tiktok' as platform
        FROM tiktok_orders 
        WHERE user_id IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT 200
      `, f1Ids)
    ]);

    const orders = [...shopeeOrders, ...tiktokOrders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 200);

    const history = orders.map(order => {
      const baseCashback = Math.floor(order.real_cashback || order.estimated_cashback || 0);
      const bonus = Math.floor(baseCashback * 0.2);
      const isCompleted = order.status === 'approved' || order.status === 'paid';
      const isRejected = order.status === 'rejected' || order.status === 'cancelled';
      const statusLabel = isCompleted ? 'Đã nhận' : (isRejected ? 'Đã hủy' : 'Chờ duyệt');

      return {
        id: order.id,
        orderId: order.id,
        f1Id: order.user_id,
        f1Name: f1Map[order.user_id]?.name || 'Thành viên F1',
        f1Email: f1Map[order.user_id]?.email || '',
        productName: order.product_name || 'Đơn hàng mua sắm',
        productImage: order.product_image || '',
        platform: order.platform,
        orderAmount: Math.floor(order.order_amount || 0),
        tier: 'F1',
        baseCashback,
        bonus,
        status: order.status,
        isCompleted,
        statusLabel,
        createdAt: order.created_at
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử giới thiệu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * 3. Danh sách mạng lưới thành viên F1
 * GET /api/referrals/members
 */
exports.getReferralMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDatabase();

    const f1Users = await db.all(`
      SELECT id, name, email, phone, avatar, created_at
      FROM users
      WHERE referred_by = ?
      ORDER BY created_at DESC
    `, [userId]);

    if (f1Users.length === 0) {
      return res.json([]);
    }

    const f1Ids = f1Users.map(u => u.id);
    const placeholders = f1Ids.map(() => '?').join(',');

    const [shopeeOrders, tiktokOrders] = await Promise.all([
      db.all(`
        SELECT user_id, order_amount, estimated_cashback, real_cashback, status
        FROM orders
        WHERE user_id IN (${placeholders})
      `, f1Ids),
      db.all(`
        SELECT user_id, order_amount, estimated_cashback, real_cashback, status
        FROM tiktok_orders
        WHERE user_id IN (${placeholders})
      `, f1Ids)
    ]);

    const allOrders = [...shopeeOrders, ...tiktokOrders];

    const members = f1Users.map(member => {
      const memberOrders = allOrders.filter(o => o.user_id === member.id);
      let totalSpent = 0;
      let totalBonusEarned = 0;
      let pendingBonus = 0;
      let completedOrdersCount = 0;
      let pendingOrdersCount = 0;

      memberOrders.forEach(o => {
        totalSpent += Math.floor(o.order_amount || 0);
        const baseCashback = Math.floor(o.real_cashback || o.estimated_cashback || 0);
        const bonus = Math.floor(baseCashback * 0.2);

        if (o.status === 'approved' || o.status === 'paid') {
          totalBonusEarned += bonus;
          completedOrdersCount++;
        } else if (o.status === 'pending' || o.status === 'processing') {
          pendingBonus += bonus;
          pendingOrdersCount++;
        }
      });

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        avatar: member.avatar || '',
        createdAt: member.created_at,
        ordersCount: memberOrders.length,
        completedOrdersCount,
        pendingOrdersCount,
        totalSpent,
        totalBonusEarned,
        pendingBonus,
        status: 'active'
      };
    });

    res.json(members);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thành viên giới thiệu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * 4. Ghi nhận lượt click link giới thiệu
 * POST /api/referrals/click (Public)
 */
exports.recordReferralClick = async (req, res) => {
  try {
    const { refId } = req.body;
    if (!refId) {
      return res.status(400).json({ message: 'Thiếu refId' });
    }

    const db = await getDatabase();
    await db.run(
      `UPDATE users SET referral_clicks = COALESCE(referral_clicks, 0) + 1 WHERE id = ?`,
      [refId]
    );

    res.json({ success: true, message: 'Đã ghi nhận lượt click giới thiệu' });
  } catch (error) {
    console.error('Lỗi khi ghi nhận click giới thiệu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};
