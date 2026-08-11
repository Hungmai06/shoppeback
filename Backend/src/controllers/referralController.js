const { getDatabase } = require('../config/db');

exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDatabase();

    // Lấy thông tin user hiện tại (lấy referral_earnings)
    const user = await db.get(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Đếm số lượng F1
    const f1Result = await db.get(`SELECT COUNT(*) as count FROM users WHERE referred_by = ?`, [userId]);
    const f1Count = f1Result ? f1Result.count : 0;

    // Lấy danh sách F1 ids
    const f1Users = await db.all(`SELECT id FROM users WHERE referred_by = ?`, [userId]);
    const f1Ids = f1Users.map(u => u.id);

    // Tính hoa hồng chờ duyệt (Pending Commission) từ các đơn hàng của F1
    let pendingCommission = 0;
    if (f1Ids.length > 0) {
      const placeholders = f1Ids.map(() => '?').join(',');
      const orders = await db.all(`
        SELECT status, estimated_cashback, real_cashback 
        FROM orders 
        WHERE user_id IN (${placeholders}) 
        AND status IN ('pending', 'processing')
      `, f1Ids);

      orders.forEach(order => {
        const baseCashback = order.real_cashback || order.estimated_cashback || 0;
        pendingCommission += (baseCashback * 0.2);
      });
    }

    res.json({
      clicks: 0, // Tính năng chưa theo dõi
      f1Count,
      f2Count: 0, // Đã bỏ F2
      pendingCommission: Math.round(pendingCommission),
      approvedCommission: Math.round(user.referral_earnings || 0)
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê giới thiệu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.getReferralHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDatabase();

    // Lấy danh sách F1 ids
    const f1Users = await db.all(`SELECT id, name FROM users WHERE referred_by = ?`, [userId]);
    
    if (f1Users.length === 0) {
      return res.json([]);
    }

    const f1Map = {};
    f1Users.forEach(u => f1Map[u.id] = u.name);
    const f1Ids = Object.keys(f1Map);
    
    const placeholders = f1Ids.map(() => '?').join(',');
    
    // Lấy tất cả đơn hàng của F1
    const orders = await db.all(`
      SELECT id, user_id, status, estimated_cashback, real_cashback, created_at 
      FROM orders 
      WHERE user_id IN (${placeholders})
      ORDER BY created_at DESC
      LIMIT 100
    `, f1Ids);

    const history = orders.map(order => {
      const baseCashback = order.real_cashback || order.estimated_cashback || 0;
      const bonus = baseCashback * 0.2;
      
      return {
        id: order.id,
        f1Name: f1Map[order.user_id],
        tier: 'F1',
        baseCashback,
        bonus,
        status: order.status,
        createdAt: order.created_at
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử giới thiệu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};
