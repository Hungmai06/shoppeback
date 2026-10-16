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
    const validIds = Array.from(new Set(targetUserIds.filter(Boolean)));
    if (validIds.length === 0) return { updatedCount: 0 };
    userQuery += ` WHERE id IN (${validIds.map(() => '?').join(',')})`;
    queryParams = validIds;
  }

  const users = await db.all(userQuery, queryParams);

  for (const u of users) {
    // 1. Tổng tiền hoàn từ các đơn hàng HOÀN THÀNH (approved hoặc paid)
    const orderRow = await db.get(
      `SELECT SUM(CASE WHEN real_cashback IS NOT NULL AND real_cashback > 0 THEN real_cashback ELSE estimated_cashback END) as totalCashback
       FROM orders
       WHERE user_id = ? AND status IN ('approved', 'paid')`,
      [u.id]
    );
    const completedCashback = Math.floor(orderRow ? (orderRow.totalCashback || 0) : 0);

    // 2. Tính hoa hồng giới thiệu F1 (20% từ các đơn hoàn thành của F1)
    const refOrderRow = await db.get(
      `SELECT SUM(FLOOR(COALESCE(real_cashback, estimated_cashback, 0) * 0.20)) as f1Commission
       FROM orders
       WHERE user_id IN (SELECT id FROM users WHERE referred_by = ?) AND status IN ('approved', 'paid')`,
      [u.id]
    );
    const calculatedF1Commission = Math.floor(refOrderRow ? (refOrderRow.f1Commission || 0) : 0);
    const refEarnings = Math.max(Math.floor(u.referral_earnings || 0), calculatedF1Commission);

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
