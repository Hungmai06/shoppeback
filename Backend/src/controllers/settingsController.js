const { getDatabase } = require('../config/db');

async function getSettings(req, res) {
  try {
    const db = await getDatabase();
    const settings = await db.get('SELECT * FROM system_settings WHERE id = 1');
    
    res.json({
      websiteName: settings.website_name,
      supportPhone: settings.support_phone,
      supportZalo: settings.support_zalo,
      supportFacebook: settings.support_facebook,
      shopeeAffiliateId: settings.shopee_affiliate_id,
      commissionPercentage: settings.commission_percentage,
      cashbackPercentage: settings.cashback_percentage,
      telegramNotification: !!settings.telegram_notification,
      emailNotification: !!settings.email_notification,
      maintenanceMode: !!settings.maintenance_mode
    });
  } catch (error) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy cấu hình hệ thống' });
  }
}

async function updateSettings(req, res) {
  const {
    websiteName,
    supportPhone,
    supportZalo,
    supportFacebook,
    shopeeAffiliateId,
    commissionPercentage,
    cashbackPercentage,
    telegramNotification,
    emailNotification,
    maintenanceMode
  } = req.body;

  try {
    const db = await getDatabase();

    await db.run(
      `UPDATE system_settings
       SET website_name = COALESCE(?, website_name),
           support_phone = COALESCE(?, support_phone),
           support_zalo = COALESCE(?, support_zalo),
           support_facebook = COALESCE(?, support_facebook),
           shopee_affiliate_id = COALESCE(?, shopee_affiliate_id),
           commission_percentage = COALESCE(?, commission_percentage),
           cashback_percentage = COALESCE(?, cashback_percentage),
           telegram_notification = COALESCE(?, telegram_notification),
           email_notification = COALESCE(?, email_notification),
           maintenance_mode = COALESCE(?, maintenance_mode),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [
        websiteName,
        supportPhone,
        supportZalo,
        supportFacebook,
        shopeeAffiliateId,
        commissionPercentage,
        cashbackPercentage,
        telegramNotification !== undefined ? (telegramNotification ? 1 : 0) : null,
        emailNotification !== undefined ? (emailNotification ? 1 : 0) : null,
        maintenanceMode !== undefined ? (maintenanceMode ? 1 : 0) : null
      ]
    );

    res.json({ message: 'Cập nhật cấu hình hệ thống thành công' });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật cấu hình' });
  }
}

async function adminGetStats(req, res) {
  try {
    const db = await getDatabase();

    // Tự động đồng bộ các đơn affiliate sang orders nếu chưa có
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

    // Fetch system settings
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    // Total registered users count
    const usersCountResult = await db.get("SELECT COUNT(*) as count FROM users");
    const totalUsers = usersCountResult ? usersCountResult.count : 0;

    // Orders count
    const ordersCountResult = await db.get("SELECT COUNT(*) as count FROM orders");
    const totalOrders = ordersCountResult ? ordersCountResult.count : 0;

    // Paid withdrawals (Tổng hoa hồng đã chi trả: khi Admin xác nhận thanh toán duyệt yêu cầu rút tiền)
    const totalPaidWithdrawalsResult = await db.get("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'approved'");
    const totalPaidWithdrawals = (totalPaidWithdrawalsResult && totalPaidWithdrawalsResult.total) ? totalPaidWithdrawalsResult.total : 0;

    // Calculate revenue (Tổng cột Hoa Hồng Shopee của tất cả các đơn HOÀN THÀNH)
    const ordersList = await db.all("SELECT id, status, real_cashback, estimated_cashback, shopee_commission, created_at FROM orders");
    
    let platformTotalRevenue = 0; // Tổng hoa hồng Shopee của các đơn hoàn thành

    ordersList.forEach(o => {
      const isCompleted = (o.status === 'approved' || o.status === 'paid');
      const shopeeComm = (o.shopee_commission !== null && o.shopee_commission !== undefined)
        ? o.shopee_commission
        : (((o.real_cashback || o.estimated_cashback || 0)) * (1 / (cashbackRate || 0.5)));

      if (isCompleted) {
        platformTotalRevenue += shopeeComm;
      }
    });

    // Lợi nhuận = Doanh thu ước tính (Hoa hồng Shopee đơn hoàn thành) - Tổng hoa hồng đã chi (Rút tiền đã duyệt)
    const netProfit = Math.max(0, platformTotalRevenue - totalPaidWithdrawals);

    // Orders by status
    const statusCounts = { pending: 0, approved: 0, rejected: 0, paid: 0, returned: 0 };
    ordersList.forEach(o => {
      const st = o.status || 'pending';
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++;
      } else {
        statusCounts.pending++;
      }
    });

    // Monthly chart data (last 6 months)
    const monthlyStatsMap = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyStatsMap[monthKey] = {
        name: `T${d.getMonth() + 1}`,
        revenue: 0,
        cashback: 0,
        profit: 0
      };
    }

    ordersList.forEach(o => {
      const isCompleted = (o.status === 'approved' || o.status === 'paid');
      if (!isCompleted) return;

      const shopeeComm = (o.shopee_commission !== null && o.shopee_commission !== undefined)
        ? o.shopee_commission
        : (((o.real_cashback || o.estimated_cashback || 0)) * (1 / (cashbackRate || 0.5)));

      const userCb = (o.real_cashback !== null && o.real_cashback !== undefined)
        ? o.real_cashback
        : (o.estimated_cashback || 0);

      const dateStr = o.created_at || '';
      if (dateStr.length >= 7) {
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        if (monthlyStatsMap[monthKey]) {
          monthlyStatsMap[monthKey].revenue += shopeeComm;
          monthlyStatsMap[monthKey].cashback += userCb;
          monthlyStatsMap[monthKey].profit += (shopeeComm - userCb);
        }
      }
    });

    const chartData = Object.values(monthlyStatsMap);

    // Daily user registration statistics (last 14 days)
    const dailyUsersMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const displayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      dailyUsersMap[dateKey] = {
        date: displayLabel,
        fullDate: dateKey,
        count: 0
      };
    }

    const allUsers = await db.all("SELECT id, created_at FROM users");
    allUsers.forEach(u => {
      const dateStr = u.created_at || '';
      if (dateStr.length >= 10) {
        const dateKey = dateStr.substring(0, 10);
        if (dailyUsersMap[dateKey]) {
          dailyUsersMap[dateKey].count++;
        }
      }
    });

    const dailyUserRegistrations = Object.values(dailyUsersMap);

    res.json({
      summary: {
        totalUsers,
        totalOrders,
        totalPaidWithdrawals,
        platformTotalRevenue,
        netProfit
      },
      statusDistribution: [
        { name: 'Đang chờ xử lý', value: statusCounts.pending },
        { name: 'Hoàn thành', value: statusCounts.approved },
        { name: 'Đã thanh toán', value: statusCounts.paid },
        { name: 'Hủy', value: statusCounts.rejected },
        { name: 'Hoàn hàng', value: statusCounts.returned }
      ],
      monthlyAnalytics: chartData,
      dailyUserRegistrations
    });
  } catch (error) {
    console.error('Admin Get Stats Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi kết xuất thống kê' });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  adminGetStats
};
