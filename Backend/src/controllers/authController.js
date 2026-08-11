const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/db');
const { ensureUuid } = require('../services/shopeeService');


function generateAccessToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey', {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

function generateRefreshToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

async function register(req, res) {
  const { name, email, password, referralCode } = req.body;

  try {
    const db = await getDatabase();

    // Check if user already exists
    const userExists = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (userExists) {
      return res.status(400).json({ message: 'Email này đã được đăng ký' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate custom ID
    const lastUser = await db.get("SELECT id FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT 1");
    let nextId = 'USR101';
    if (lastUser && lastUser.id.startsWith('USR')) {
      const lastNum = parseInt(lastUser.id.substring(3));
      nextId = `USR${lastNum + 1}`;
    }

    // Check if referral code is valid
    let validReferredBy = null;
    if (referralCode) {
      const referrer = await db.get('SELECT id FROM users WHERE id = ?', [referralCode.trim().toUpperCase()]);
      if (referrer) {
        validReferredBy = referrer.id;
      }
    }

    // Generate affiliate sub id (UUID)
    const affiliateSubId = ensureUuid(nextId);

    // Insert user
    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role, status, referred_by, affiliate_sub_id)
       VALUES (?, ?, ?, ?, 'user', 'active', ?, ?)`,
      [
        nextId,
        name,
        email,
        passwordHash,
        validReferredBy,
        affiliateSubId
      ]
    );

    // Create system notification
    const notifId = `NT${Date.now()}`;
    await db.run(
      `INSERT INTO notifications (id, user_id, title, content, type)
       VALUES (?, ?, 'Chào mừng thành viên mới', 'Chào mừng bạn đến với Hoàn Tiền Mua Sắm! Dán ngay link sản phẩm Shopee của bạn để nhận hoàn tiền đầu tiên.', 'system')`,
      [notifId, nextId]
    );

    const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [nextId]);

    const accessToken = generateAccessToken(nextId);
    const refreshToken = generateRefreshToken(nextId);

    // Save refresh token to db
    await db.run('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, nextId]);

    res.status(201).json({
      token: accessToken,
      refreshToken: refreshToken,
      user
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký tài khoản' });
  }
}

async function login(req, res) {
  const { email, password, role } = req.body;

  try {
    const db = await getDatabase();

    // Find user
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không chính xác' });
    }

    // Check role
    if (role && user.role !== role) {
      return res.status(403).json({ message: `Tài khoản này không có quyền truy cập vai trò ${role}` });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không chính xác' });
    }

    if (user.status === 'locked') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to db
    await db.run('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);

    const affiliateSubId = user.affiliate_sub_id || ensureUuid(user.id);

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        affiliateSubId: affiliateSubId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bankName: user.bank_name,
        accountNumber: user.account_number,
        accountHolder: user.account_holder,
        telegramChatId: user.telegram_chat_id,
        emailNotify: !!user.email_notify,
        telegramNotify: !!user.telegram_notify,
        balance: user.balance || 0,
        totalCashback: user.total_cashback || 0,
        pendingCashback: user.pending_cashback || 0,
        referralEarnings: user.referral_earnings || 0,
        referredBy: user.referred_by || null,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập' });
  }
}

async function getProfile(req, res) {
  try {
    const db = await getDatabase();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Get order and wallet stats
    const orders = await db.all('SELECT status, real_cashback, estimated_cashback FROM orders WHERE user_id = ?', [user.id]);
    const withdrawals = await db.all('SELECT amount, status FROM withdrawals WHERE user_id = ?', [user.id]);

    // Calculate balances
    const pendingCashback = orders
      .filter(o => o.status === 'pending')
      .reduce((sum, o) => sum + o.estimated_cashback, 0);

    const approvedCashback = orders
      .filter(o => o.status === 'approved' || o.status === 'paid')
      .reduce((sum, o) => sum + (o.real_cashback || o.estimated_cashback), 0);

    const approvedCashback100 = approvedCashback * 2; // raw 100% Shopee commission for reference

    const paidWithdrawals = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + w.amount, 0);

    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    const availableBalance = Math.max(0, (approvedCashback + (user.referral_earnings || 0)) - (paidWithdrawals + pendingWithdrawals));

    const affiliateSubId = user.affiliate_sub_id || ensureUuid(user.id);

    res.json({
      profile: {
        id: user.id,
        affiliateSubId: affiliateSubId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        bankName: user.bank_name,
        accountNumber: user.account_number,
        accountHolder: user.account_holder,
        telegramChatId: user.telegram_chat_id,
        emailNotify: !!user.email_notify,
        telegramNotify: !!user.telegram_notify,
        balance: user.balance || 0,
        totalCashback: user.total_cashback || 0,
        pendingCashback: user.pending_cashback || 0,
        referralEarnings: user.referral_earnings || 0,
        referredBy: user.referred_by || null,
        role: user.role
      },
      stats: {
        pendingCashback,
        approvedCashback100,
        approvedCashback,
        paidWithdrawals,
        pendingWithdrawals,
        availableBalance
      }
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy hồ sơ người dùng' });
  }
}

async function updateProfile(req, res) {
  const { name, phone, bankName, accountNumber, accountHolder, telegramChatId, emailNotify, telegramNotify } = req.body;

  try {
    const db = await getDatabase();

    await db.run(
      `UPDATE users
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           bank_name = COALESCE(?, bank_name),
           account_number = COALESCE(?, account_number),
           account_holder = COALESCE(?, account_holder),
           telegram_chat_id = COALESCE(?, telegram_chat_id),
           email_notify = COALESCE(?, email_notify),
           telegram_notify = COALESCE(?, telegram_notify),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        phone,
        bankName,
        accountNumber,
        accountHolder ? accountHolder.toUpperCase() : null,
        telegramChatId,
        emailNotify !== undefined ? (emailNotify ? 1 : 0) : null,
        telegramNotify !== undefined ? (telegramNotify ? 1 : 0) : null,
        req.user.id
      ]
    );

    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    res.json({
      message: 'Cập nhật hồ sơ thành công',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        bankName: updatedUser.bank_name,
        accountNumber: updatedUser.account_number,
        accountHolder: updatedUser.account_holder,
        telegramChatId: updatedUser.telegram_chat_id,
        emailNotify: !!updatedUser.email_notify,
        telegramNotify: !!updatedUser.telegram_notify,
        balance: updatedUser.balance || 0,
        totalCashback: updatedUser.total_cashback || 0,
        pendingCashback: updatedUser.pending_cashback || 0,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật hồ sơ' });
  }
}

async function getNotifications(req, res) {
  try {
    const db = await getDatabase();
    const notifications = await db.all(
      'SELECT id, title, content, type, `read`, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(notifications.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      type: n.type,
      read: !!n.read,
      time: n.created_at
    })));
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy thông báo' });
  }
}

async function readNotifications(req, res) {
  try {
    const db = await getDatabase();
    await db.run('UPDATE notifications SET `read` = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Đã đánh dấu đọc tất cả thông báo' });
  } catch (error) {
    console.error('Read Notifications Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đánh dấu đọc thông báo' });
  }
}

async function adminGetUsers(req, res) {
  try {
    const db = await getDatabase();
    const users = await db.all(
      `SELECT id, name, email, phone, bank_name as bankName, 
              account_number as accountNumber, account_holder as accountHolder, 
              telegram_chat_id as telegramChatId, email_notify as emailNotify, 
              telegram_notify as telegramNotify, role, status, balance, 
              total_cashback as totalCashback, pending_cashback as pendingCashback, 
              referral_earnings as referralEarnings,
              referred_by as referredBy,
              created_at as createdAt 
       FROM users`
    );
    res.json(users);
  } catch (error) {
    console.error('Admin Get Users Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng' });
  }
}

async function adminUpdateUser(req, res) {
  const { id } = req.params;
  const { name, email, role, bankName, accountNumber, accountHolder, phone } = req.body;

  try {
    const db = await getDatabase();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    await db.run(
      `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           role = COALESCE(?, role),
           phone = COALESCE(?, phone),
           bank_name = COALESCE(?, bank_name),
           account_number = COALESCE(?, account_number),
           account_holder = COALESCE(?, account_holder),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, email, role, phone, bankName, accountNumber, accountHolder ? accountHolder.toUpperCase() : null, id]
    );

    res.json({ message: 'Cập nhật thông tin thành viên thành công' });
  } catch (error) {
    console.error('Admin Update User Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin thành viên' });
  }
}

async function adminCreateUser(req, res) {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu' });
  }

  try {
    const db = await getDatabase();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ message: 'Email này đã được sử dụng' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const prefix = (role === 'admin') ? 'ADM' : 'USR';
    const lastUser = await db.get(`SELECT id FROM users WHERE id LIKE '${prefix}%' ORDER BY created_at DESC LIMIT 1`);
    let nextId = prefix === 'ADM' ? 'ADM100' : 'USR100';
    if (lastUser && lastUser.id.startsWith(prefix)) {
      const lastNum = parseInt(lastUser.id.substring(3));
      nextId = `${prefix}${lastNum + 1}`;
    }

    await db.run(
      `INSERT INTO users (id, name, email, password_hash, phone, avatar, role, status)
       VALUES (?, ?, ?, ?, ?, '', ?, 'active')`,
      [nextId, name, email, passwordHash, phone || '', role || 'user']
    );

    res.status(201).json({ message: 'Tạo tài khoản thành viên thành công', id: nextId });
  } catch (error) {
    console.error('Admin Create User Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo tài khoản' });
  }
}

async function adminDeleteUser(req, res) {
  const { id } = req.params;
  try {
    const db = await getDatabase();
    const user = await db.get('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Xóa tài khoản thành viên thành công' });
  } catch (error) {
    console.error('Admin Delete User Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa tài khoản' });
  }
}

async function adminResetPassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body;
  const password = newPassword || '123456';
  try {
    const db = await getDatabase();
    const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, id]);
    res.json({ message: `Đặt lại mật khẩu thành công về: ${password}` });
  } catch (error) {
    console.error('Admin Reset Password Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đặt lại mật khẩu' });
  }
}

async function adminToggleUserStatus(req, res) {
  const { id } = req.params;
  try {
    const db = await getDatabase();
    const user = await db.get('SELECT id, status FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const newStatus = user.status === 'active' ? 'locked' : 'active';
    await db.run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    res.json({ message: newStatus === 'locked' ? 'Kóa tài khoản thành công' : 'Mở khóa tài khoản thành công', status: newStatus });
  } catch (error) {
    console.error('Admin Toggle Status Error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật trạng thái' });
  }
}

async function refreshToken(req, res) {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: 'Missing refresh token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    const db = await getDatabase();
    const user = await db.get('SELECT id, refresh_token FROM users WHERE id = ?', [decoded.id]);

    if (!user || user.refresh_token !== token) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    await db.run('UPDATE users SET refresh_token = ? WHERE id = ?', [newRefreshToken, user.id]);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  getNotifications,
  readNotifications,
  adminGetUsers,
  adminUpdateUser,
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminToggleUserStatus,
  refreshToken
};
