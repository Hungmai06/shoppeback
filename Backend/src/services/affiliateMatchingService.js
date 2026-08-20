const { getDatabase } = require('../config/db');

/**
 * Extract Shop ID and Item ID from various Shopee URL formats
 * Examples:
 * - https://shopee.vn/product-title-i.123456.789012
 * - https://shopee.vn/product/123456/789012
 * - https://shopee.vn/universal-link/product/123456/789012
 * - Query params: ?itemid=789012&shopid=123456 or ?item_id=789012&shop_id=123456
 *
 * @param {string} inputUrl 
 * @returns {{ shopId: string|null, itemId: string|null }}
 */
function extractShopeeIds(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { shopId: null, itemId: null };
  }

  const trimmed = inputUrl.trim();
  let shopId = null;
  let itemId = null;

  // 1. Check direct pattern: -i.{shopId}.{itemId}
  const iPattern = /-i\.(\d+)\.(\d+)/i;
  const iMatch = trimmed.match(iPattern);
  if (iMatch) {
    shopId = iMatch[1];
    itemId = iMatch[2];
    return { shopId, itemId };
  }

  // 2. Check /product/{shopId}/{itemId}
  const productPattern = /\/product\/(\d+)\/(\d+)/i;
  const productMatch = trimmed.match(productPattern);
  if (productMatch) {
    shopId = productMatch[1];
    itemId = productMatch[2];
    return { shopId, itemId };
  }

  // 3. Check query parameters if valid URL
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const queryItemId = urlObj.searchParams.get('itemid') || urlObj.searchParams.get('item_id') || urlObj.searchParams.get('itemId');
    const queryShopId = urlObj.searchParams.get('shopid') || urlObj.searchParams.get('shop_id') || urlObj.searchParams.get('shopId');

    if (queryItemId) itemId = queryItemId;
    if (queryShopId) shopId = queryShopId;
  } catch (err) {
    // Ignore URL parse error for non-standard link fragments
  }

  // 4. Fallback if input is purely numeric itemId
  if (!itemId && /^\d+$/.test(trimmed)) {
    itemId = trimmed;
  }

  return { shopId, itemId };
}

/**
 * Safely parse any date/time string into a Date object or null
 * @param {string|Date|number} dateInput 
 * @returns {Date|null}
 */
function parseDateTime(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Try standard ISO or direct parse
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try YYYY-MM-DD HH:mm:ss format (common in Shopee CSV reports)
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2}):?(\d{1,2})?/);
  if (match) {
    parsed = new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10),
      parseInt(match[4], 10),
      parseInt(match[5], 10),
      parseInt(match[6] || '0', 10)
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * Calculate time difference and score based on match window
 * 
 * Score breakdown for time distance:
 * - <= 5 mins: +30
 * - <= 15 mins: +25
 * - <= 30 mins: +20
 * - <= 60 mins: +15
 * - <= 120 mins: +10
 * - <= windowMinutes: +5
 * - > windowMinutes: 0
 *
 * @param {string|Date} clickedAt 
 * @param {string|Date} targetTime (shopee_click_time or order_time)
 * @param {number} windowMinutes 
 * @returns {{ points: number, diffSeconds: number, diffMinutes: number, isValid: boolean }}
 */
function calculateTimeScore(clickedAt, targetTime, windowMinutes = 120) {
  const dClicked = parseDateTime(clickedAt);
  const dTarget = parseDateTime(targetTime);

  if (!dClicked || !dTarget) {
    return { points: 0, diffSeconds: Infinity, diffMinutes: Infinity, isValid: false };
  }

  const diffMs = Math.abs(dTarget.getTime() - dClicked.getTime());
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = diffSeconds / 60;

  if (diffMinutes > windowMinutes) {
    return { points: 0, diffSeconds, diffMinutes, isValid: false };
  }

  let points = 0;
  if (diffMinutes <= 5) {
    points = 30;
  } else if (diffMinutes <= 15) {
    points = 25;
  } else if (diffMinutes <= 30) {
    points = 20;
  } else if (diffMinutes <= 60) {
    points = 15;
  } else if (diffMinutes <= 120) {
    points = 10;
  } else {
    points = 5;
  }

  return { points, diffSeconds, diffMinutes: Math.round(diffMinutes * 10) / 10, isValid: true };
}

/**
 * Map raw Shopee order status into normalized status
 * @param {string} rawStatus 
 * @returns {'pending'|'approved'|'rejected'|'returned'}
 */
function mapShopeeFulfillmentStatus(rawStatus) {
  if (!rawStatus) return 'pending';
  const norm = rawStatus.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    norm.includes('hoan hang') ||
    norm.includes('tra hang') ||
    norm.includes('returned') ||
    norm.includes('refunded')
  ) {
    return 'returned';
  }

  if (
    norm.includes('hoan thanh') ||
    norm.includes('thanh cong') ||
    norm.includes('completed') ||
    norm.includes('approved') ||
    norm.includes('da thanh toan') ||
    norm.includes('paid') ||
    norm.includes('giao thanh cong')
  ) {
    return 'approved';
  }

  if (
    norm.includes('huy') ||
    norm.includes('tu choi') ||
    norm.includes('rejected') ||
    norm.includes('cancelled') ||
    norm.includes('that bai') ||
    norm.includes('khong hop le') ||
    norm.includes('invalid')
  ) {
    return 'rejected';
  }

  return 'pending';
}

/**
 * Dual-method automatic order matching engine
 * 
 * PHƯƠNG PHÁP 1 — MATCH BẰNG SUB_ID (Ưu tiên cao nhất)
 * - Đọc Sub_id1 -> Sub_id5
 * - Tìm trong affiliate_clicks và bảng users
 * - Nếu match: matched_by = "SUB_ID", match_score = 100, status = "CONFIRMED"
 * - Không bị ghi đè bởi phương pháp 2
 * 
 * PHƯƠNG PHÁP 2 — MATCH FALLBACK BẰNG ITEM_ID + SHOP_ID + THỜI GIAN
 * - Chỉ chạy khi Sub_id trống hoặc không match
 * - Lọc click có item_id, shop_id trùng và thời gian trong AFFILIATE_MATCH_WINDOW_MINUTES
 * - Điểm: Item trùng (+40), Shop trùng (+30), Time gần (+30) => Tối đa 100
 * - Ngưỡng tự động: AFFILIATE_AUTO_MATCH_SCORE (mặc định 80)
 * - Nếu 1 candidate >= threshold: status = "CONFIRMED", matched_by = "ITEM_SHOP_TIME"
 * - Nếu nhiều candidate >= threshold: status = "NEED_REVIEW", user_id = null
 * - Nếu 0 candidate: status = "UNMATCHED", user_id = null
 *
 * @param {Object} orderData
 * @param {Object} db
 * @returns {Promise<{
 *   userId: string|null,
 *   status: 'CONFIRMED'|'NEED_REVIEW'|'UNMATCHED',
 *   matchedBy: 'SUB_ID'|'ITEM_SHOP_TIME'|null,
 *   matchScore: number|null,
 *   matchedClickId: string|null,
 *   matchedSubId: string|null,
 *   candidates: Array<any>
 * }>}
 */
async function matchOrder(orderData, db) {
  const windowMinutes = parseInt(process.env.AFFILIATE_MATCH_WINDOW_MINUTES || '120', 10);
  const autoMatchScoreThreshold = parseInt(process.env.AFFILIATE_AUTO_MATCH_SCORE || '80', 10);

  const subIds = [
    orderData.sub_id1,
    orderData.sub_id2,
    orderData.sub_id3,
    orderData.sub_id4,
    orderData.sub_id5
  ].map(s => (s ? String(s).trim() : '')).filter(Boolean);

  // =========================================================================
  // PHƯƠNG PHÁP 1 — MATCH BẰNG SUB_ID (ƯU TIÊN CAO NHẤT)
  // =========================================================================
  if (subIds.length > 0) {
    for (const subId of subIds) {
      // 1.1 Tìm trong bảng affiliate_clicks theo sub_id hoặc click_id
      const clickMatch = await db.get(
        `SELECT id, click_id, user_id, sub_id, item_id, shop_id, clicked_at 
         FROM affiliate_clicks 
         WHERE (sub_id = ? OR click_id = ?) AND user_id IS NOT NULL 
         ORDER BY clicked_at DESC LIMIT 1`,
        [subId, subId]
      );

      if (clickMatch && clickMatch.user_id) {
        console.log(`[AFFILIATE MATCH] 🎯 Order ${orderData.order_id} MATCHED by SUB_ID: "${subId}" -> User: ${clickMatch.user_id} (Score: 100, ClickId: ${clickMatch.click_id})`);
        return {
          userId: clickMatch.user_id,
          status: 'CONFIRMED',
          matchedBy: 'SUB_ID',
          matchScore: 100,
          matchedClickId: clickMatch.click_id || clickMatch.id,
          matchedSubId: subId,
          candidates: []
        };
      }

      // 1.2 Tìm trực tiếp trong bảng users (trường hợp sub_id là id user hoặc affiliate_sub_id)
      const userDirectMatch = await db.get(
        'SELECT id, affiliate_sub_id FROM users WHERE id = ? OR affiliate_sub_id = ? LIMIT 1',
        [subId, subId]
      );

      if (userDirectMatch && userDirectMatch.id) {
        console.log(`[AFFILIATE MATCH] 🎯 Order ${orderData.order_id} MATCHED by SUB_ID directly to User: ${userDirectMatch.id} (Score: 100)`);
        return {
          userId: userDirectMatch.id,
          status: 'CONFIRMED',
          matchedBy: 'SUB_ID',
          matchScore: 100,
          matchedClickId: null,
          matchedSubId: subId,
          candidates: []
        };
      }
    }
  }

  // =========================================================================
  // PHƯƠNG PHÁP 2 — MATCH FALLBACK BẰNG ITEM_ID + SHOP_ID + THỜI GIAN
  // =========================================================================
  const orderItemId = orderData.item_id ? String(orderData.item_id).trim() : null;
  const orderShopId = orderData.shop_id ? String(orderData.shop_id).trim() : null;
  const targetTime = orderData.shopee_click_time || orderData.order_time;

  if (!targetTime) {
    console.log(`[AFFILIATE MATCH] ⚠️ Order ${orderData.order_id} has no order_time or click_time. Cannot perform time fallback matching.`);
    return {
      userId: null,
      status: 'UNMATCHED',
      matchedBy: null,
      matchScore: null,
      matchedClickId: null,
      matchedSubId: null,
      candidates: []
    };
  }

  // Lấy các click có user_id hợp lệ
  let candidateClicks = [];
  if (orderItemId && orderShopId) {
    candidateClicks = await db.all(
      `SELECT c.id, c.click_id, c.user_id, c.sub_id, c.item_id, c.shop_id, c.origin_url, c.clicked_at, u.name as user_name, u.email as user_email
       FROM affiliate_clicks c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.user_id IS NOT NULL 
         AND (c.item_id = ? OR c.shop_id = ?)
       ORDER BY c.clicked_at DESC`,
      [orderItemId, orderShopId]
    );
  } else if (orderItemId) {
    candidateClicks = await db.all(
      `SELECT c.id, c.click_id, c.user_id, c.sub_id, c.item_id, c.shop_id, c.origin_url, c.clicked_at, u.name as user_name, u.email as user_email
       FROM affiliate_clicks c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.user_id IS NOT NULL AND c.item_id = ?
       ORDER BY c.clicked_at DESC`,
      [orderItemId]
    );
  } else {
    // Nếu cả item_id và shop_id đều không có trong order thì lấy click theo thời gian
    candidateClicks = await db.all(
      `SELECT c.id, c.click_id, c.user_id, c.sub_id, c.item_id, c.shop_id, c.origin_url, c.clicked_at, u.name as user_name, u.email as user_email
       FROM affiliate_clicks c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.user_id IS NOT NULL
       ORDER BY c.clicked_at DESC LIMIT 100`
    );
  }

  // Chấm điểm từng candidate click
  const scoredCandidates = [];
  for (const click of candidateClicks) {
    let itemScore = 0;
    let shopScore = 0;

    const clickItemId = click.item_id ? String(click.item_id).trim() : '';
    const clickShopId = click.shop_id ? String(click.shop_id).trim() : '';

    if (orderItemId && clickItemId && orderItemId === clickItemId) {
      itemScore = 40;
    }
    if (orderShopId && clickShopId && orderShopId === clickShopId) {
      shopScore = 30;
    }

    const timeResult = calculateTimeScore(click.clicked_at, targetTime, windowMinutes);
    if (!timeResult.isValid) {
      continue; // Nằm ngoài match window cho phép
    }

    const totalScore = itemScore + shopScore + timeResult.points;

    scoredCandidates.push({
      clickId: click.click_id || click.id,
      userId: click.user_id,
      userName: click.user_name || '',
      userEmail: click.user_email || '',
      itemId: click.item_id,
      shopId: click.shop_id,
      clickedAt: click.clicked_at,
      itemScore,
      shopScore,
      timeScore: timeResult.points,
      timeDiffMinutes: timeResult.diffMinutes,
      score: totalScore
    });
  }

  // Nhóm theo user_id để lấy điểm cao nhất cho mỗi user
  const userBestCandidateMap = new Map();
  for (const cand of scoredCandidates) {
    const existing = userBestCandidateMap.get(cand.userId);
    if (!existing || cand.score > existing.score || (cand.score === existing.score && cand.timeDiffMinutes < existing.timeDiffMinutes)) {
      userBestCandidateMap.set(cand.userId, cand);
    }
  }

  const distinctCandidates = Array.from(userBestCandidateMap.values())
    .sort((a, b) => b.score - a.score || a.timeDiffMinutes - b.timeDiffMinutes);

  // Lọc các candidate đạt ngưỡng auto match
  const eligibleCandidates = distinctCandidates.filter(c => c.score >= autoMatchScoreThreshold);

  // QUY TẮC AN TOÀN
  if (eligibleCandidates.length === 1) {
    // Duy nhất 1 candidate đạt điểm cao
    const winner = eligibleCandidates[0];
    console.log(`[AFFILIATE MATCH] 🎯 Order ${orderData.order_id} MATCHED by ITEM_SHOP_TIME: Item ${orderItemId}, Shop ${orderShopId}, Diff ${winner.timeDiffMinutes}m -> User: ${winner.userId} (Score: ${winner.score}, ClickId: ${winner.clickId})`);

    return {
      userId: winner.userId,
      status: 'CONFIRMED',
      matchedBy: 'ITEM_SHOP_TIME',
      matchScore: winner.score,
      matchedClickId: winner.clickId,
      matchedSubId: null,
      candidates: distinctCandidates
    };
  }

  if (eligibleCandidates.length > 1) {
    // Nhiều candidate có điểm tương đương hoặc không đủ chắc chắn -> NEED_REVIEW
    const candidateSummary = eligibleCandidates.map(c => `${c.userId} (Score: ${c.score}, Diff: ${c.timeDiffMinutes}m)`).join(', ');
    console.log(`[AFFILIATE MATCH] ⚠️ Order ${orderData.order_id} NEED_REVIEW: Multiple eligible candidates found: [${candidateSummary}]`);

    return {
      userId: null,
      status: 'NEED_REVIEW',
      matchedBy: null,
      matchScore: eligibleCandidates[0].score,
      matchedClickId: null,
      matchedSubId: null,
      candidates: distinctCandidates
    };
  }

  // Không có candidate nào đạt threshold
  console.log(`[AFFILIATE MATCH] ❌ Order ${orderData.order_id} UNMATCHED: No candidate met auto match threshold (${autoMatchScoreThreshold}). Top candidate score: ${distinctCandidates[0] ? distinctCandidates[0].score : 'none'}`);

  return {
    userId: null,
    status: 'UNMATCHED',
    matchedBy: null,
    matchScore: distinctCandidates[0] ? distinctCandidates[0].score : null,
    matchedClickId: null,
    matchedSubId: null,
    candidates: distinctCandidates
  };
}

/**
 * Financial Safety Wallet Crediting
 * Only credit money to user when:
 * 1. Order attribution is CONFIRMED or CONFIRMED_MANUAL
 * 2. Shopee fulfillment status is approved/completed/paid
 * 3. User is valid and money hasn't been credited yet
 *
 * @param {Object} orderObj
 * @param {Object} db
 * @param {string} adminUserId
 * @returns {Promise<{ credited: boolean, cashback: number, refBonus: number }>}
 */
async function creditUserCashbackIfEligible(orderObj, db, adminUserId = null) {
  const { order_id, user_id, commission, shopee_status, status } = orderObj;

  const isConfirmed = status === 'CONFIRMED' || status === 'CONFIRMED_MANUAL';
  const mappedStatus = mapShopeeFulfillmentStatus(shopee_status);
  const isEligiblePayout = mappedStatus === 'approved';

  if (!isConfirmed || !isEligiblePayout || !user_id) {
    return { credited: false, cashback: 0, refBonus: 0 };
  }

  // Lấy tỷ lệ hoàn tiền từ settings (mặc định 50%)
  const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
  const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;
  const userCashback = Math.round((commission || 0) * cashbackRate);

  if (userCashback <= 0) {
    return { credited: false, cashback: 0, refBonus: 0 };
  }

  // Cập nhật số dư ví user
  await db.run(
    `UPDATE users 
     SET balance = COALESCE(balance, 0) + ?,
         total_cashback = COALESCE(total_cashback, 0) + ?
     WHERE id = ?`,
    [userCashback, userCashback, user_id]
  );

  // Kiểm tra hoa hồng giới thiệu 20%
  let refBonus = 0;
  try {
    const userRecord = await db.get('SELECT referred_by FROM users WHERE id = ?', [user_id]);
    if (userRecord && userRecord.referred_by) {
      refBonus = Math.round(userCashback * 0.20);
      if (refBonus > 0) {
        await db.run(
          `UPDATE users 
           SET balance = COALESCE(balance, 0) + ?,
               referral_earnings = COALESCE(referral_earnings, 0) + ?
           WHERE id = ?`,
          [refBonus, refBonus, userRecord.referred_by]
        );

        const refNotifId = `NT_REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await db.run(
          `INSERT INTO notifications (id, user_id, title, content, type)
           VALUES (?, ?, 'Hoa hồng giới thiệu', ?, 'system')`,
          [
            refNotifId,
            userRecord.referred_by,
            `Bạn nhận được +${refBonus.toLocaleString('vi-VN')}đ hoa hồng từ đơn hàng của người bạn giới thiệu.`
          ]
        );
      }
    }
  } catch (err) {
    // Ignore referral bonus error if referred_by column doesn't exist
  }

  // Thông báo cho user
  const notifId = `NT_ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await db.run(
    `INSERT INTO notifications (id, user_id, title, content, type)
     VALUES (?, ?, 'Hoàn tiền đơn hàng thành công', ?, 'order')`,
    [
      notifId,
      user_id,
      `Đơn hàng Shopee #${order_id} đã hoàn thành. Số tiền +${userCashback.toLocaleString('vi-VN')}đ đã được cộng vào số dư ví của bạn.`
    ]
  );

  console.log(`[AFFILIATE FINANCE] 💰 Credited +${userCashback}đ to User: ${user_id} for Order #${order_id} (Ref Bonus: +${refBonus}đ)`);

  return { credited: true, cashback: userCashback, refBonus };
}

module.exports = {
  extractShopeeIds,
  parseDateTime,
  calculateTimeScore,
  mapShopeeFulfillmentStatus,
  matchOrder,
  creditUserCashbackIfEligible
};
