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
      addlivetagApiKey: settings.addlivetag_api_key || process.env.ADDLIVETAG_API_KEY || '',
      lazadaAffiliateId: settings.lazada_affiliate_id || '',
      lazadaCookieUrl: settings.lazada_cookie_url || 'https://s.lazada.vn/s.an_redir',
      tiktokAffiliateId: settings.tiktok_affiliate_id || '',
      tiktokCookieUrl: settings.tiktok_cookie_url || 'https://vt.tiktok.com/an_redir',
      tikiAffiliateId: settings.tiki_affiliate_id || '',
      tikiCookieUrl: settings.tiki_cookie_url || 'https://tiki.vn/an_redir',
      hasRiohubApiKey: Boolean(settings.riohub_api_key || process.env.RIOHUB_API_KEY),
      riohubCreatorUsername: settings.riohub_creator_username || process.env.RIOHUB_CREATOR_USERNAME || 'hungrevieweverything',
      riohubApiKey: settings.riohub_api_key || '',
      riohubWebhookSecret: settings.riohub_webhook_secret || process.env.RIOHUB_WEBHOOK_SECRET || '',
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
    addlivetagApiKey,
    lazadaAffiliateId,
    lazadaCookieUrl,
    tiktokAffiliateId,
    tiktokCookieUrl,
    tikiAffiliateId,
    tikiCookieUrl,
    riohubApiKey,
    riohubCreatorUsername,
    riohubWebhookSecret,
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
           addlivetag_api_key = COALESCE(?, addlivetag_api_key),
           lazada_affiliate_id = COALESCE(?, lazada_affiliate_id),
           lazada_cookie_url = COALESCE(?, lazada_cookie_url),
           tiktok_affiliate_id = COALESCE(?, tiktok_affiliate_id),
           tiktok_cookie_url = COALESCE(?, tiktok_cookie_url),
           tiki_affiliate_id = COALESCE(?, tiki_affiliate_id),
           tiki_cookie_url = COALESCE(?, tiki_cookie_url),
           riohub_api_key = COALESCE(?, riohub_api_key),
           riohub_creator_username = COALESCE(?, riohub_creator_username),
           riohub_webhook_secret = COALESCE(?, riohub_webhook_secret),
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
        addlivetagApiKey !== undefined ? addlivetagApiKey : null,
        lazadaAffiliateId,
        lazadaCookieUrl,
        tiktokAffiliateId,
        tiktokCookieUrl,
        tikiAffiliateId,
        tikiCookieUrl,
        riohubApiKey !== undefined ? riohubApiKey : null,
        riohubCreatorUsername !== undefined ? riohubCreatorUsername : null,
        riohubWebhookSecret !== undefined ? riohubWebhookSecret : null,
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
  const { range = 'all', platform = 'all' } = req.query;

  try {
    const db = await getDatabase();

    // Fetch system settings
    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    // Users count
    const usersCountResult = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
    const totalUsers = usersCountResult ? usersCountResult.count : 0;

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

    // Orders list from both Shopee and TikTok
    const [shopeeList, tiktokList] = await Promise.all([
      db.all(`SELECT id, user_id, product_name, order_amount, real_cashback, estimated_cashback, shopee_commission, status, created_at, 'shopee' as platform FROM orders WHERE 1=1 ${dateFilter}`),
      db.all(`SELECT id, user_id, product_name, order_amount, real_cashback, estimated_cashback, tiktok_commission as shopee_commission, status, created_at, 'tiktok' as platform FROM tiktok_orders WHERE 1=1 ${dateFilter}`)
    ]);

    // Breakdown metrics by platform
    const calcPlatformMetrics = (list) => {
      let revenue = 0;
      let cashback = 0;
      let orderAmount = 0;
      let approvedCount = 0;
      let pendingCount = 0;

      list.forEach(o => {
        orderAmount += Number(o.order_amount || 0);
        const isApproved = o.status === 'approved' || o.status === 'paid';
        const isShopee = o.platform === 'shopee';

        // Đơn Shopee: BẮT BUỘC CHỈ TÍNH HOA HỒNG KHI ĐƠN ĐÃ HOÀN THÀNH (approved / paid)
        const shouldCountCommission = isShopee ? isApproved : (o.status !== 'rejected' && o.status !== 'returned');

        if (shouldCountCommission) {
          const userCb = Math.floor(
            (o.real_cashback !== null && o.real_cashback !== undefined && Number(o.real_cashback) > 0)
              ? Number(o.real_cashback)
              : (Number(o.estimated_cashback) || 0)
          );
          let rawComm = Number(o.shopee_commission || 0);
          if (rawComm <= 0) {
            rawComm = userCb > 0 ? userCb * 2 : Math.floor(Number(o.order_amount || 0) * 0.1);
          }
          const comm = Math.floor(rawComm);

          revenue += comm;
          cashback += userCb;
        }

        if (isApproved) {
          approvedCount++;
        } else if (o.status === 'pending') {
          pendingCount++;
        }
      });

      return {
        totalOrders: list.length,
        orderAmount,
        revenue,
        cashback,
        profit: Math.max(0, revenue - cashback),
        approvedCount,
        pendingCount
      };
    };

    const shopeeBreakdown = calcPlatformMetrics(shopeeList);
    const tiktokBreakdown = calcPlatformMetrics(tiktokList);

    // Apply platform filter if specified
    let ordersList = [];
    if (platform === 'shopee') {
      ordersList = shopeeList;
    } else if (platform === 'tiktok') {
      ordersList = tiktokList;
    } else {
      ordersList = [...shopeeList, ...tiktokList];
    }
    const totalOrders = ordersList.length;

    let platformTotalRevenue = 0; // Total 100% Commission
    let platformTotalCashbackOwed = 0; // Total user cashback

    // Top Users & Products map
    const userEarningsMap = {};
    const productCountMap = {};

    ordersList.forEach(o => {
      const isApproved = o.status === 'approved' || o.status === 'paid';
      const isShopee = o.platform === 'shopee';
      const shouldCount = isShopee ? isApproved : (o.status !== 'rejected' && o.status !== 'returned');

      if (shouldCount) {
        const userCb = Math.floor(
          (o.real_cashback !== null && o.real_cashback !== undefined && Number(o.real_cashback) > 0)
            ? Number(o.real_cashback)
            : (Number(o.estimated_cashback) || 0)
        );

        let rawComm = Number(o.shopee_commission || 0);
        if (rawComm <= 0) {
          rawComm = userCb > 0 ? userCb * 2 : Math.floor(Number(o.order_amount || 0) * 0.1);
        }
        const comm = Math.floor(rawComm);

        platformTotalRevenue += comm;
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
    const remainingAfterPayout = Math.max(0, platformTotalRevenue - totalPaidWithdrawals);

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

    // Helper to extract YYYY-MM
    const extractYearMonth = (val) => {
      if (!val) return '';
      const str = String(val).trim();
      const matchIso = str.match(/^(\d{4})[\/\-](\d{1,2})/);
      if (matchIso) return `${matchIso[1]}-${String(matchIso[2]).padStart(2, '0')}`;
      const matchVn = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (matchVn) return `${matchVn[3]}-${String(matchVn[2]).padStart(2, '0')}`;
      const num = Number(str);
      if (!isNaN(num) && num > 20000 && num < 100000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
      const d = new Date(str);
      if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return '';
    };

    // Monthly chart data (last 6 months)
    const monthlyStatsMap = {};
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyStatsMap[monthKey] = {
        name: `T${d.getMonth() + 1}`,
        revenue: 0,
        cashback: 0,
        profit: 0,
        shopeeRevenue: 0,
        tiktokRevenue: 0
      };
    }

    ordersList.forEach(o => {
      const userCb = Math.floor(
        (o.real_cashback !== null && o.real_cashback !== undefined && Number(o.real_cashback) > 0)
          ? Number(o.real_cashback)
          : (Number(o.estimated_cashback) || 0)
      );

      let rawComm = Number(o.shopee_commission || 0);
      if (rawComm <= 0) {
        rawComm = userCb > 0 ? userCb * 2 : Math.floor(Number(o.order_amount || 0) * 0.1);
      }
      const comm = Math.floor(rawComm);

      const isApproved = o.status === 'approved' || o.status === 'paid';
      const isShopee = o.platform === 'shopee';
      const shouldCount = isShopee ? isApproved : (o.status !== 'rejected' && o.status !== 'returned');

      const monthKey = extractYearMonth(o.created_at) || currentMonthKey;
      if (monthlyStatsMap[monthKey]) {
        if (shouldCount) {
          monthlyStatsMap[monthKey].revenue += comm;
          monthlyStatsMap[monthKey].cashback += userCb;
          monthlyStatsMap[monthKey].profit += Math.max(0, comm - userCb);
          if (o.platform === 'tiktok') {
            monthlyStatsMap[monthKey].tiktokRevenue += comm;
          } else {
            monthlyStatsMap[monthKey].shopeeRevenue += comm;
          }
        }
      }
    });

    const chartData = Object.values(monthlyStatsMap);

    // === DAILY ANALYTICS FOR SELECTED MONTH ===
    const selectedMonth = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selYearStr, selMonthStr] = selectedMonth.split('-');
    const selYear = parseInt(selYearStr) || now.getFullYear();
    const selMonth = parseInt(selMonthStr) || (now.getMonth() + 1);

    const daysInSelMonth = new Date(selYear, selMonth, 0).getDate();

    const dailyMap = {};
    for (let day = 1; day <= daysInSelMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthPadded = String(selMonth).padStart(2, '0');
      const dateKey = `${selYear}-${monthPadded}-${dayStr}`;
      dailyMap[dateKey] = {
        date: dateKey,
        day,
        dayLabel: `${dayStr}/${monthPadded}`,
        revenue: 0,
        cashback: 0,
        profit: 0,
        orderCount: 0,
        shopeeRevenue: 0,
        tiktokRevenue: 0,
        shopeeOrderCount: 0,
        tiktokOrderCount: 0
      };
    }

    const availableMonths = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = `Tháng ${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      availableMonths.push({ key: mKey, label: mLabel });
    }

    const extractYearMonthDay = (val) => {
      if (!val) return '';
      const str = String(val).trim();
      const matchIso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (matchIso) return `${matchIso[1]}-${String(matchIso[2]).padStart(2, '0')}-${String(matchIso[3]).padStart(2, '0')}`;
      const matchVn = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (matchVn) return `${matchVn[3]}-${String(matchVn[2]).padStart(2, '0')}-${String(matchVn[1]).padStart(2, '0')}`;
      const num = Number(str);
      if (!isNaN(num) && num > 20000 && num < 100000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
      const d = new Date(str);
      if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return '';
    };

    const selMonthStart = `${selYear}-${String(selMonth).padStart(2, '0')}-01 00:00:00`;
    const lastDayOfMonth = new Date(selYear, selMonth, 0).getDate();
    const selMonthEnd = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')} 23:59:59`;

    const [shopeeMonthOrders, tiktokMonthOrders] = await Promise.all([
      db.all(`SELECT real_cashback, estimated_cashback, shopee_commission, status, created_at, 'shopee' as platform FROM orders WHERE created_at >= ? AND created_at <= ?`, [selMonthStart, selMonthEnd]),
      db.all(`SELECT real_cashback, estimated_cashback, tiktok_commission as shopee_commission, status, created_at, 'tiktok' as platform FROM tiktok_orders WHERE created_at >= ? AND created_at <= ?`, [selMonthStart, selMonthEnd])
    ]);

    let selectedMonthOrders = [];
    if (platform === 'shopee') {
      selectedMonthOrders = shopeeMonthOrders;
    } else if (platform === 'tiktok') {
      selectedMonthOrders = tiktokMonthOrders;
    } else {
      selectedMonthOrders = [...shopeeMonthOrders, ...tiktokMonthOrders];
    }

    selectedMonthOrders.forEach(o => {
      const dateKey = extractYearMonthDay(o.created_at);
      if (dailyMap[dateKey]) {
        const userCb = Math.floor(
          (o.real_cashback !== null && o.real_cashback !== undefined && Number(o.real_cashback) > 0)
            ? Number(o.real_cashback)
            : (Number(o.estimated_cashback) || 0)
        );
        let rawComm = Number(o.shopee_commission || 0);
        if (rawComm <= 0) {
          rawComm = userCb > 0 ? userCb * 2 : Math.floor(Number(o.order_amount || 0) * 0.1);
        }
        const comm = Math.floor(rawComm);

        const isApproved = o.status === 'approved' || o.status === 'paid';
        const isShopee = o.platform === 'shopee';
        const shouldCount = isShopee ? isApproved : (o.status !== 'rejected' && o.status !== 'returned');

        if (shouldCount) {
          dailyMap[dateKey].revenue += comm;
          dailyMap[dateKey].cashback += userCb;
          dailyMap[dateKey].profit += Math.max(0, comm - userCb);
          if (o.platform === 'tiktok') {
            dailyMap[dateKey].tiktokRevenue += comm;
          } else {
            dailyMap[dateKey].shopeeRevenue += comm;
          }
        }
        dailyMap[dateKey].orderCount += 1;
        if (o.platform === 'tiktok') {
          dailyMap[dateKey].tiktokOrderCount += 1;
        } else {
          dailyMap[dateKey].shopeeOrderCount += 1;
        }
      }
    });

    const dailyAnalytics = Object.values(dailyMap);

    res.json({
      summary: {
        totalUsers,
        totalOrders,
        totalPaidWithdrawals,
        pendingWithdrawalsTotal,
        platformTotalRevenue,
        platformTotalCashbackOwed,
        netProfit,
        remainingAfterPayout
      },
      platformBreakdown: {
        shopee: shopeeBreakdown,
        tiktok: tiktokBreakdown
      },
      currentPlatform: platform,
      statusDistribution: [
        { name: 'Đang chờ xử lý', value: statusCounts.pending },
        { name: 'Hoàn thành', value: statusCounts.approved },
        { name: 'Đã thanh toán', value: statusCounts.paid },
        { name: 'Hủy', value: statusCounts.rejected },
        { name: 'Hoàn hàng', value: statusCounts.returned }
      ],
      monthlyAnalytics: chartData,
      dailyAnalytics,
      selectedMonth,
      availableMonths,
      topUsers,
      topProducts
    });
  } catch (error) {
    console.error('Admin Get Stats Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi kết xuất thống kê' });
  }
}

async function testAddLiveTagKey(req, res) {
  const { apiKey } = req.body;
  const keyToTest = (apiKey || process.env.ADDLIVETAG_API_KEY || '').trim();
  if (!keyToTest) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp API Key để kiểm tra' });
  }

  // Gọi thử với sample Shopee itemId để kiểm tra xem key có hợp lệ không
  const testUrl = `https://data.addlivetag.com/product-data/product-data.php?item_id=25514686481&key=${encodeURIComponent(keyToTest)}`;
  try {
    const response = await fetch(testUrl, {
      headers: {
        'X-API-Key': keyToTest,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const data = await response.json();
    if (data.status === 'success') {
      return res.json({
        success: true,
        message: 'Kết nối AddLiveTag API thành công! API Key hợp lệ và hoạt động tốt.',
        productName: data.productInfo?.productName
      });
    } else {
      const errMsg = data.message || data.apiKeyNotice?.message || 'API Key không hợp lệ hoặc đã hết hạn từ addlivetag.com';
      return res.status(400).json({
        success: false,
        message: errMsg,
        raw: data
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Lỗi kết nối tới addlivetag.com: ${err.message}`
    });
  }
}

async function testRiohubKey(req, res) {
  const { apiKey, creatorUsername } = req.body;
  const keyToTest = (apiKey || process.env.RIOHUB_API_KEY || '').trim();
  if (!keyToTest) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp RioHub API Key để kiểm tra' });
  }

  let usernameToTest = (creatorUsername || '').trim().replace(/^@/, '');
  if (!usernameToTest) {
    const { getRiohubCreatorUsername } = require('../services/riohubService');
    usernameToTest = (await getRiohubCreatorUsername()).replace(/^@/, '');
  }

  if (!usernameToTest) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập Creator Username (ví dụ: hungrevieweverything) để kiểm tra kết nối'
    });
  }

  try {
    const { executeRiohubRequest } = require('../services/riohubService');
    const endpoint = `/partner/tiktok/affiliate/links?creator_username=${encodeURIComponent(usernameToTest)}&page=1&page_size=1`;
    const result = await executeRiohubRequest(endpoint, {
      apiKey: keyToTest,
      timeoutMs: 8000
    });

    return res.json({
      success: true,
      message: `Kết nối RioHub API thành công! API Key và Creator (@${usernameToTest}) hợp lệ, hoạt động tốt.`,
      data: result
    });
  } catch (err) {
    let msg = err.message || 'Lỗi kết nối tới RioHub';
    if (err.status === 401) {
      msg = 'RioHub API Key không chính xác hoặc đã hết hạn (401 Unauthorized)';
    } else if (err.status === 403) {
      msg = `Creator (@${usernameToTest}) không thuộc quyền quản lý của API key này (403 Forbidden)`;
    } else if (err.status === 404) {
      msg = `Creator (@${usernameToTest}) chưa kết nối với RioHub hoặc tài khoản TikTok Shop không tồn tại (404 Not Found)`;
    }
    return res.status(err.status || 400).json({
      success: false,
      message: msg,
      status: err.status
    });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  adminGetStats,
  testAddLiveTagKey,
  testRiohubKey
};
