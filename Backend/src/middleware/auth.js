const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/db');

async function protect(req, res, next) {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');

      const db = await getDatabase();
      const user = await db.get(
        'SELECT id, name, email, role, status FROM users WHERE id = ?',
        [decoded.id]
      );

      if (!user) {
        return res.status(401).json({ message: 'Người dùng không tồn tại' });
      }

      if (user.status === 'locked') {
        return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa' });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('JWT Auth Error:', error);
      return res.status(401).json({ message: 'Không được ủy quyền, token không hợp lệ' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Không được ủy quyền, thiếu token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Không được ủy quyền, chỉ dành cho quản trị viên' });
  }
}

function optionalAuth(req, res, next) {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
      getDatabase().then(db => {
        db.get('SELECT id, name, email, role, status FROM users WHERE id = ?', [decoded.id])
          .then(user => {
            if (user && user.status !== 'locked') {
              req.user = user;
            }
            next();
          })
          .catch(() => next());
      }).catch(() => next());
      return;
    } catch (error) {
      // Ignore token parse error for optional auth
    }
  }
  next();
}

module.exports = { protect, adminOnly, optionalAuth };
