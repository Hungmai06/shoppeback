/**
 * balanceService.js
 * Dịch vụ tính toán và đồng bộ số dư người dùng chuẩn xác tuyệt đối:
 * Số Dư Khả Dụng = (Tổng hoàn tiền từ đơn hoàn thành [approved/paid] + Hoa hồng giới thiệu) - (Tổng tiền rút [approved/pending])
 * Tổng tiền hoàn = Tổng hoàn tiền từ đơn hoàn thành [approved/paid]
 */

const { getDatabase } = require('../config/db');

async function recalculateUserBalances(dbInstance = null, targetUserIds = null) {
  const db = dbInstance || (await getDatabase());

  let userQuery = 'SELECT id, referral_earnings FROM users';
  let queryParams = [];

  if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
    let validIds = Array.from(new Set(targetUserIds.filter(Boolean)));
    if (validIds.length === 0) return { updatedCount: 0 };

    // Tự động tìm thêm tất cả người giới thiệu (referrer) của các user này
    // để cập nhật lại hoa hồng và số dư cho người giới thiệu khi đơn của F1 hoàn thành/thay đổi trạng thái!
    try {
      const placeholders = validIds.map(() => '?').join(',');
      const referrerRows = await db.all(
        `SELECT DISTINCT referred_by FROM users WHERE id IN (${placeholders}) AND referred_by IS NOT NULL AND referred_by != ''`,
        validIds
      );
      for (const r of referrerRows) {
        if (r.referred_by && !validIds.includes(r.referred_by)) {
          validIds.push(r.referred_by);
        }
      }
    } catch (e) {
      console.warn('Error expanding referrers in recalculateUserBalances:', e.message);
    }

    userQuery += ` WHERE id IN (${validIds.map(() => '?').join(',')})`;
    queryParams = validIds;
  }

  const users = await db.all(userQuery, queryParams);

  for (const u of users) {
    // 1. Tổng tiền hoàn từ các đơn hàng HOÀN THÀNH (approved hoặc paid) từ cả Shopee và TikTok
    const orderRow = await db.get(
      `SELECT SUM(CASE WHEN real_cashback IS NOT NULL AND real_cashback > 0 THEN real_cashback ELSE estimated_cashback END) as totalCashback
       FROM orders
       WHERE user_id = ? AND status IN ('approved', 'paid')`,
      [u.id]
    );
    const completedShopee = Math.floor(orderRow ? (orderRow.totalCashback || 0) : 0);

    const ttOrderRow = await db.get(
      `SELECT SUM(CASE WHEN real_cashback IS NOT NULL AND real_cashback > 0 THEN real_cashback ELSE estimated_cashback END) as totalCashback
       FROM tiktok_orders
       WHERE user_id = ? AND status IN ('approved', 'paid')`,
      [u.id]
    );
    const completedTikTok = Math.floor(ttOrderRow ? (ttOrderRow.totalCashback || 0) : 0);
    const completedCashback = completedShopee + completedTikTok;

    // 2. Tính hoa hồng giới thiệu F1 (20% từ các đơn hoàn thành của F1) từ cả Shopee và TikTok
    const refOrderRow = await db.get(
      `SELECT SUM(FLOOR(COALESCE(real_cashback, estimated_cashback, 0) * 0.20)) as f1Commission
       FROM orders
       WHERE user_id IN (SELECT id FROM users WHERE referred_by = ?) AND status IN ('approved', 'paid')`,
      [u.id]
    );
    const refTikTokRow = await db.get(
      `SELECT SUM(FLOOR(COALESCE(real_cashback, estimated_cashback, 0) * 0.20)) as f1Commission
       FROM tiktok_orders
       WHERE user_id IN (SELECT id FROM users WHERE referred_by = ?) AND status IN ('approved', 'paid')`,
      [u.id]
    );
    const calculatedF1Commission = Math.floor((refOrderRow?.f1Commission || 0) + (refTikTokRow?.f1Commission || 0));
    const refEarnings = calculatedF1Commission;

    // 3. Tổng tiền rút (approved và pending)
    const withRow = await db.get(
      `SELECT SUM(amount) as totalWithdrawn
       FROM withdrawals
       WHERE user_id = ? AND status IN ('approved', 'pending')`,
      [u.id]
    );
    const totalDeductions = Math.floor(withRow ? (withRow.totalWithdrawn || 0) : 0);

    // 4. Số dư khả dụng = max(0, (completedCashback + refEarnings) - totalDeductions)
    const calculatedBalance = Math.max(0, (completedCashback + refEarnings) - totalDeductions);

    await db.run(
      `UPDATE users
       SET balance = ?,
           total_cashback = ?,
           referral_earnings = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [calculatedBalance, completedCashback, refEarnings, u.id]
    );
  }

  return { updatedCount: users.length };
}

module.exports = {
  recalculateUserBalances
};
