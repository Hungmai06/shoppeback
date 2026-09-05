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
      shopeeCookieUrl: settings.shopee_cookie_url || 'https://s.shopee.vn/an_redir',
      lazadaAffiliateId: settings.lazada_affiliate_id || '',
      lazadaCookieUrl: settings.lazada_cookie_url || 'https://s.lazada.vn/s.an_redir',
      tiktokAffiliateId: settings.tiktok_affiliate_id || '',
      tiktokCookieUrl: settings.tiktok_cookie_url || 'https://vt.tiktok.com/an_redir',
      tikiAffiliateId: settings.tiki_affiliate_id || '',
      tikiCookieUrl: settings.tiki_cookie_url || 'https://tiki.vn/an_redir',
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
    shopeeCookieUrl,
    lazadaAffiliateId,
    lazadaCookieUrl,
    tiktokAffiliateId,
    tiktokCookieUrl,
    tikiAffiliateId,
    tikiCookieUrl,
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
           shopee_cookie_url = COALESCE(?, shopee_cookie_url),
           lazada_affiliate_id = COALESCE(?, lazada_affiliate_id),
           lazada_cookie_url = COALESCE(?, lazada_cookie_url),
           tiktok_affiliate_id = COALESCE(?, tiktok_affiliate_id),
           tiktok_cookie_url = COALESCE(?, tiktok_cookie_url),
           tiki_affiliate_id = COALESCE(?, tiki_affiliate_id),
           tiki_cookie_url = COALESCE(?, tiki_cookie_url),
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
        shopeeCookieUrl,
        lazadaAffiliateId,
        lazadaCookieUrl,
        tiktokAffiliateId,
        tiktokCookieUrl,
        tikiAffiliateId,
        tikiCookieUrl,
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
  const { range = 'all' } = req.query;

  try {
    const db = await getDatabase();

    // Fetch system settings
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    // Users count
    const usersCountResult = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
    const totalUsers = usersCountResult.count;

    // Pending withdrawals total
    const pendingWithdrawalsResult = await db.get("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'pending'");
    const pendingWithdrawalsTotal = pendingWithdrawalsResult ? (pendingWithdrawalsResult.total || 0) : 0;

    // Paid withdrawals total
    const paidWithdrawalsResult = await db.get("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'approved'");
    const totalPaidWithdrawals = paidWithdrawalsResult ? (paidWithdrawalsResult.total || 0) : 0;

    // Build date filter clause for orders query based on range
    let dateFilter = '';
    const now = new Date();
    if (range === 'today') {
      const todayStr = now.toISOString().substring(0, 10);
      dateFilter = ` AND created_at >= '${todayStr} 00:00:00'`;
    } else if (range === '7days') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = ` AND created_at >= '${d7.toISOString().substring(0, 10)} 00:00:00'`;
    } else if (range === '30days') {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = ` AND created_at >= '${d30.toISOString().substring(0, 10)} 00:00:00'`;
    } else if (range === 'this_month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      dateFilter = ` AND created_at >= '${monthStart} 00:00:00'`;
    }

    // Orders list
    const ordersList = await db.all(`SELECT id, user_id, product_name, order_amount, real_cashback, estimated_cashback, shopee_commission, status, created_at FROM orders WHERE 1=1 ${dateFilter}`);
    const totalOrders = ordersList.length;

    let platformTotalRevenue = 0; // Total 100% Shopee commission
    let platformTotalCashbackOwed = 0; // Total user cashback

    // Top Users & Products map
    const userEarningsMap = {};
    const productCountMap = {};

    ordersList.forEach(o => {
      const userCb = (o.real_cashback !== null && o.real_cashback !== undefined)
        ? o.real_cashback
        : (o.estimated_cashback || 0);

      const shopeeComm = (o.shopee_commission !== null && o.shopee_commission !== undefined)
        ? o.shopee_commission
        : (userCb * 2);

      if (o.status === 'approved' || o.status === 'paid') {
        platformTotalRevenue += shopeeComm;
        platformTotalCashbackOwed += userCb;

        if (o.user_id) {
          if (!userEarningsMap[o.user_id]) {
            userEarningsMap[o.user_id] = { userId: o.user_id, earnings: 0, orderCount: 0 };
          }
          userEarningsMap[o.user_id].earnings += userCb;
          userEarningsMap[o.user_id].orderCount += 1;
        }
      }

      if (o.product_name) {
        const shortName = o.product_name.length > 35 ? o.product_name.substring(0, 32) + '...' : o.product_name;
        if (!productCountMap[shortName]) {
          productCountMap[shortName] = { name: shortName, count: 0, totalAmount: 0 };
        }
        productCountMap[shortName].count += 1;
        productCountMap[shortName].totalAmount += (o.order_amount || 0);
      }
    });

    const netProfit = platformTotalRevenue - platformTotalCashbackOwed;

    // Attach user names to top users
    const allUsers = await db.all("SELECT id, name, email FROM users");
    const userNameMap = {};
    allUsers.forEach(u => { userNameMap[u.id] = u.name || u.email; });

    const topUsers = Object.values(userEarningsMap)
      .map(u => ({ ...u, userName: userNameMap[u.userId] || u.userId }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5);

    const topProducts = Object.values(productCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Orders by status
    const statusCounts = { pending: 0, approved: 0, rejected: 0, paid: 0, returned: 0 };
    ordersList.forEach(o => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      }
    });

    // Monthly chart data (last 6 months)
    const monthlyStatsMap = {};

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
      const userCb = (o.real_cashback !== null && o.real_cashback !== undefined)
        ? o.real_cashback
        : (o.estimated_cashback || 0);

      const shopeeComm = (o.shopee_commission !== null && o.shopee_commission !== undefined)
        ? o.shopee_commission
        : (userCb * 2);

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

    res.json({
      summary: {
        totalUsers,
        totalOrders,
        totalPaidWithdrawals,
        pendingWithdrawalsTotal,
        platformTotalRevenue,
        platformTotalCashbackOwed,
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
      topUsers,
      topProducts
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
