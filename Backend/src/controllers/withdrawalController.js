const { getDatabase } = require('../config/db');

async function requestWithdrawal(req, res) {
  const { amount, bankName, accountNumber, accountHolder } = req.body;

  if (!amount || !bankName || !accountNumber || !accountHolder) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin rút tiền' });
  }

  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount < 50000) {
    return res.status(400).json({ message: 'Số tiền rút tối thiểu là 50.000đ' });
  }

  try {
    const db = await getDatabase();
    const userId = req.user.id;

    // Calculate user's current available balance
    const orders = await db.all('SELECT status, real_cashback, estimated_cashback FROM orders WHERE user_id = ?', [userId]);
    const withdrawals = await db.all('SELECT amount, status FROM withdrawals WHERE user_id = ?', [userId]);

    const userObj = await db.get('SELECT referral_earnings FROM users WHERE id = ?', [userId]);
    const refEarnings = userObj ? (userObj.referral_earnings || 0) : 0;

    const approvedCashback = orders
      .filter(o => o.status === 'approved' || o.status === 'paid')
      .reduce((sum, o) => sum + (o.real_cashback || o.estimated_cashback), 0);

    const paidWithdrawals = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + w.amount, 0);

    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    const availableBalance = Math.max(0, (approvedCashback + refEarnings) - (paidWithdrawals + pendingWithdrawals));

    if (withdrawAmount > availableBalance) {
      return res.status(400).json({ message: `Số dư khả dụng không đủ. Số dư khả dụng hiện tại: ${availableBalance.toLocaleString('vi-VN')}đ` });
    }

    // Begin database transaction to record withdrawal and update user's default bank info
    await db.run('BEGIN TRANSACTION');

    const withdrawalId = `WD${Date.now()}`;
    await db.run(
      `INSERT INTO withdrawals (id, user_id, amount, bank_name, account_number, account_holder, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [withdrawalId, userId, withdrawAmount, bankName, accountNumber, accountHolder.toUpperCase()]
    );

    // Auto-update user's bank details if they were empty or updated
    await db.run(
      `UPDATE users
       SET bank_name = ?,
           account_number = ?,
           account_holder = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [bankName, accountNumber, accountHolder.toUpperCase(), userId]
    );

    // Create user notification
    const notifId = `NT${Date.now()}`;
    await db.run(
      `INSERT INTO notifications (id, user_id, title, content, type)
       VALUES (?, ?, 'Yêu cầu rút tiền đang được xử lý', ?, 'wallet')`,
      [
        notifId,
        userId,
        `Yêu cầu rút ${withdrawAmount.toLocaleString('vi-VN')}đ của bạn đã được gửi. Chúng tôi sẽ xử lý trong vòng 24h.`
      ]
    );

    await db.run('COMMIT');

    res.status(201).json({
      message: 'Yêu cầu rút tiền đã được gửi thành công',
      withdrawalId
    });
  } catch (error) {
    const db = await getDatabase();
    await db.run('ROLLBACK');
    console.error('Withdrawal Request Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi gửi yêu cầu rút tiền' });
  }
}

async function getUserWithdrawals(req, res) {
  try {
    const db = await getDatabase();
    const withdrawals = await db.all(
      'SELECT id, amount, bank_name as bankName, account_number as accountNumber, account_holder as accountHolder, status, request_date as requestDate, processed_date as processedDate, notes FROM withdrawals WHERE user_id = ? ORDER BY request_date DESC',
      [req.user.id]
    );
    res.json(withdrawals);
  } catch (error) {
    console.error('Get User Withdrawals Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy lịch sử rút tiền' });
  }
}

async function adminGetWithdrawals(req, res) {
  try {
    const db = await getDatabase();
    const withdrawals = await db.all(
      `SELECT w.id, w.user_id as userId, u.name as userName, w.amount, w.bank_name as bankName, 
              w.account_number as accountNumber, w.account_holder as accountHolder, 
              w.status, w.request_date as requestDate, w.processed_date as processedDate, w.notes
       FROM withdrawals w
       JOIN users u ON w.user_id = u.id
       ORDER BY w.request_date DESC`
    );
    res.json(withdrawals);
  } catch (error) {
    console.error('Admin Get Withdrawals Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách rút tiền quản trị' });
  }
}

async function adminUpdateWithdrawalStatus(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái rút tiền không hợp lệ' });
  }

  try {
    const db = await getDatabase();

    const withdrawal = await db.get('SELECT * FROM withdrawals WHERE id = ?', [id]);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu rút tiền' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Yêu cầu rút tiền này đã được xử lý từ trước' });
    }

    await db.run(
      `UPDATE withdrawals
       SET status = ?,
           processed_date = CURRENT_TIMESTAMP,
           notes = ?
       WHERE id = ?`,
      [status, notes || null, id]
    );

    // Create user notification
    const notifId = `NT${Date.now()}`;
    const title = status === 'approved' ? 'Rút tiền thành công' : 'Yêu cầu rút tiền bị từ chối';
    const content = status === 'approved'
      ? `Yêu cầu rút ${withdrawal.amount.toLocaleString('vi-VN')}đ đã được duyệt thành công. Tiền sẽ được chuyển tới tài khoản của bạn.`
      : `Yêu cầu rút ${withdrawal.amount.toLocaleString('vi-VN')}đ bị từ chối. Lý do: ${notes || 'Thông tin tài khoản không hợp lệ'}`;

    await db.run(
      `INSERT INTO notifications (id, user_id, title, content, type)
       VALUES (?, ?, ?, ?, 'wallet')`,
      [notifId, withdrawal.user_id, title, content]
    );

    res.json({ message: `Đã cập nhật trạng thái yêu cầu rút tiền thành công` });
  } catch (error) {
    console.error('Admin Update Withdrawal Status Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật yêu cầu rút tiền' });
  }
}

module.exports = {
  requestWithdrawal,
  getUserWithdrawals,
  adminGetWithdrawals,
  adminUpdateWithdrawalStatus
};
