const { generateShopeeAffiliateLink } = require('../services/shopeeService');
const { getDatabase } = require('../config/db');

async function createAffiliateLink(req, res) {
  const { originUrl } = req.body;

  if (!originUrl) {
    return res.status(400).json({ message: 'originUrl là bắt buộc' });
  }

  try {
    const db = await getDatabase();
    
    let user = req.user;
    if (user && user.id) {
      const dbUser = await db.get('SELECT * FROM users WHERE id = ?', [user.id]);
      if (dbUser) {
        user = dbUser;
      }
    }

    const affiliateLink = generateShopeeAffiliateLink(originUrl, user);

    // Optionally log click log if user is logged in
    let clickId = null;
    if (user && user.id) {
      clickId = `CLK${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
      await db.run(
        'INSERT INTO click_logs (id, user_id, product_url) VALUES (?, ?, ?)',
        [clickId, user.id, originUrl]
      );
    }

    return res.json({
      success: true,
      affiliateLink,
      originUrl,
      clickId
    });
  } catch (error) {
    console.error('Create Affiliate Link Error:', error);
    return res.status(400).json({ message: error.message || 'Không thể tạo link affiliate' });
  }
}

module.exports = {
  createAffiliateLink
};
