const { getDatabase } = require('./src/config/db');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Replicate detectSeparator from reconciliationController.js
function detectSeparator(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLine = content.split('\n')[0];
  if (firstLine.includes(';')) return ';';
  return ',';
}

// Replicate mapShopeeStatus from reconciliationController.js
function mapShopeeStatus(shopeeStatus) {
  if (!shopeeStatus) return 'pending';
  const norm = shopeeStatus.trim().toLowerCase();
  if (norm.includes('hoàn thành') || norm.includes('completed') || norm.includes('đã thanh toán') || norm.includes('paid')) {
    return 'approved'; 
  }
  if (norm.includes('hủy') || norm.includes('cancelled') || norm.includes('cancelled_by_system') || norm.includes('invalid') || norm.includes('không hợp lệ') || norm.includes('hủy bỏ') || norm.includes('bị từ chối')) {
    return 'rejected';
  }
  return 'pending';
}

// Replicate extractRowFields from reconciliationController.js
function normalizeHeader(key) {
  if (!key) return '';
  return key.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[^a-z0-9]/g, ''); // remove non-alphanumeric characters
}

function extractRowFields(row) {
  const normMap = {};
  for (const key of Object.keys(row)) {
    normMap[normalizeHeader(key)] = { orig: key, val: row[key] };
  }

  let orderId = null;
  for (const normKey of ['iddonhang', 'madonhang', 'ordersn', 'orderid', 'id', 'sn']) {
    if (normMap[normKey]) {
      orderId = normMap[normKey].val;
      break;
    }
  }

  let subId = null;
  for (const normKey of ['subid1', 'subid', 'sub1', 'sub_id1']) {
    if (normMap[normKey]) {
      subId = normMap[normKey].val;
      break;
    }
  }

  let productName = null;
  for (const normKey of ['tenitem', 'tensanpham', 'itemname', 'productname', 'tensp', 'tenitem']) {
    if (normMap[normKey]) {
      productName = normMap[normKey].val;
      break;
    }
  }

  let orderAmount = 0;
  for (const normKey of ['giatridonhangd', 'giatridonhang', 'orderamount', 'amount', 'order_val', 'giatridonhang1']) {
    if (normMap[normKey]) {
      orderAmount = parseFloat(normMap[normKey].val.toString().replace(/[^0-9.-]/g, '')) || 0;
      break;
    }
  }

  let commission = 0;
  for (const normKey of ['hoahongrongtipthilienketd', 'hoahongrongtipthilienket', 'commission', 'hoahong', 'netcommission', 'hoahongrongtipthilienket1']) {
    if (normMap[normKey]) {
      commission = parseFloat(normMap[normKey].val.toString().replace(/[^0-9.-]/g, '')) || 0;
      break;
    }
  }

  let shopeeStatus = null;
  for (const normKey of ['trangthaidathang', 'trangthaidonhang', 'trangthai', 'status']) {
    if (normMap[normKey]) {
      shopeeStatus = normMap[normKey].val;
      break;
    }
  }

  let purchaseTime = null;
  for (const normKey of ['thoigiandathang', 'thoigiantao', 'thoigiandat', 'purchasetime', 'ordertime', 'thoigiandathang1']) {
    if (normMap[normKey]) {
      purchaseTime = normMap[normKey].val;
      break;
    }
  }
  if (!purchaseTime) {
    for (const entry of Object.values(normMap)) {
      if (entry.val && entry.val.toString().match(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/)) {
        purchaseTime = entry.val;
        break;
      }
    }
  }

  return { orderId, subId, productName, orderAmount, commission, shopeeStatus, purchaseTime };
}

async function runTest() {
  const tempFileName = 'file-1783935696387-632768525.csv';
  const tempFilePath = path.resolve(__dirname, 'uploads', tempFileName);

  try {
    const db = await getDatabase();
    
    // Fetch users, orders for sync
    const allUsers = await db.all('SELECT id FROM users');
    const userIds = new Set(allUsers.map(u => u.id));

    const allOrders = await db.all('SELECT id, status, user_id FROM orders');
    const existingOrdersMap = new Map(allOrders.map(o => [o.id.toLowerCase(), { status: o.status, userId: o.user_id }]));

    let insertedCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;

    const rowsToProcess = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(tempFilePath)
        .pipe(csv({ separator: detectSeparator(tempFilePath) }))
        .on('data', (row) => {
          rowsToProcess.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const settings = await db.get('SELECT cashback_percentage FROM system_settings WHERE id = 1');
    const cashbackRate = (settings ? settings.cashback_percentage : 50.0) / 100.0;

    console.log(`Processing ${rowsToProcess.length} rows...`);

    // Begin transaction simulator
    await db.run('BEGIN TRANSACTION');

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const { orderId, subId, productName, orderAmount, commission, shopeeStatus, purchaseTime } = extractRowFields(row);

      if (!orderId) {
        ignoredCount++;
        continue;
      }

      const cleanSubId = subId ? subId.trim() : '';
      const mappedStatus = mapShopeeStatus(shopeeStatus);
      const lowerOrderId = orderId.toLowerCase();
      const exists = existingOrdersMap.has(lowerOrderId);
      const dbOrder = exists ? existingOrdersMap.get(lowerOrderId) : null;
      const currentDbStatus = dbOrder ? dbOrder.status : '';
      const currentDbUserId = dbOrder ? dbOrder.userId : null;

      let targetUserId = null;
      if (cleanSubId && userIds.has(cleanSubId)) {
        targetUserId = cleanSubId;
      } else {
        if (exists) {
          targetUserId = currentDbUserId || null;
        } else {
          targetUserId = null;
        }
      }

      try {
        if (exists) {
          if (currentDbStatus === 'paid') {
            ignoredCount++;
            continue;
          }

          const statusChanged = currentDbStatus !== mappedStatus;
          const userChanged = currentDbUserId !== targetUserId;

          if (!statusChanged && !userChanged) {
            ignoredCount++;
            continue;
          }

          await db.run(
            `UPDATE orders
             SET status = ?,
                 user_id = ?,
                 real_cashback = ?,
                 order_amount = ?,
                 product_name = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [mappedStatus, targetUserId, commission, orderAmount, productName, orderId]
          );

          if (targetUserId && ((statusChanged && mappedStatus === 'approved') || userChanged)) {
            const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
            const amountDisplay = (commission * cashbackRate).toLocaleString('vi-VN');
            await db.run(
              `INSERT INTO notifications (id, user_id, title, content, type)
               VALUES (?, ?, ?, ?, 'order')`,
              [
                notifId,
                targetUserId,
                'Đơn hàng đã được duyệt hoàn tiền',
                `Đơn hàng ${orderId} (${productName.substring(0, 20)}...) đã đối soát thành công cho bạn. Số tiền hoàn +${amountDisplay}đ đã được cộng.`
              ]
            );
          }

          updatedCount++;
        } else {
          const orderTime = purchaseTime || new Date().toISOString().replace('T', ' ').substring(0, 19);

          await db.run(
            `INSERT INTO orders (id, user_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              orderId,
              targetUserId,
              productName || 'Sản phẩm mua từ Shopee',
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200',
              orderAmount,
              commission,
              commission,
              mappedStatus,
              orderTime
            ]
          );

          if (targetUserId) {
            if (mappedStatus === 'approved') {
              const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
              const amountDisplay = (commission * cashbackRate).toLocaleString('vi-VN');
              await db.run(
                `INSERT INTO notifications (id, user_id, title, content, type)
                 VALUES (?, ?, ?, ?, 'order')`,
                [
                  notifId,
                  targetUserId,
                  'Đơn hàng ghi nhận & đã duyệt',
                  `Đơn hàng mới ${orderId} (${productName.substring(0, 20)}...) đã được thêm và duyệt thành công. Tiền hoàn +${amountDisplay}đ đã được cộng.`
                ]
              );
            } else {
              const notifId = `NT${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
              await db.run(
                `INSERT INTO notifications (id, user_id, title, content, type)
                 VALUES (?, ?, ?, ?, 'order')`,
                [
                  notifId,
                  targetUserId,
                  'Đơn hàng mới được ghi nhận',
                  `Đơn hàng Shopee ${orderId} trị giá ${orderAmount.toLocaleString('vi-VN')}đ đã được cập nhật vào lịch sử. Đang chờ đối soát.`
                ]
              );
            }
          }

          insertedCount++;
        }
      } catch (rowErr) {
        console.error(`Error at row index ${i} (orderId: ${orderId}):`, rowErr);
        throw rowErr;
      }
    }

    console.log('Inserting reconciliation log...');
    const logId = `REC${Date.now()}`;
    await db.run(
      `INSERT INTO reconciliation_logs (id, file_name, total_rows, matched_count, duplicate_count, invalid_count, missing_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        tempFileName,
        rowsToProcess.length,
        insertedCount + updatedCount,
        ignoredCount,
        0,
        0
      ]
    );

    await db.run('COMMIT');
    console.log('Success! Simulation complete.');
    console.log({ inserted: insertedCount, updated: updatedCount, ignored: ignoredCount });
  } catch (err) {
    console.error('Simulation Failed:', err);
  }
}

runTest();
