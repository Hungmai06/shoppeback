const { getDatabase } = require('./src/config/db');
const {
  extractShopeeIds,
  calculateTimeScore,
  matchOrder,
  creditUserCashbackIfEligible
} = require('./src/services/affiliateMatchingService');
const { confirmAffiliateOrder } = require('./src/controllers/affiliateOrderController');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING SHOPEE AFFILIATE AUTOMATIC ATTRIBUTION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    const db = await getDatabase();

    // -------------------------------------------------------------------------
    // TEST 1: URL & ID Extraction
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing extractShopeeIds ---');
    const testUrl1 = 'https://shopee.vn/Áo-Thun-Cotton-Cao-Cấp-i.12345678.987654321?sp_atk=123';
    const ext1 = extractShopeeIds(testUrl1);
    assert(ext1.shopId === '12345678' && ext1.itemId === '987654321', 'Extract from -i.{shopId}.{itemId} URL');

    const testUrl2 = 'https://shopee.vn/product/888777/999111?item_id=999111';
    const ext2 = extractShopeeIds(testUrl2);
    assert(ext2.shopId === '888777' && ext2.itemId === '999111', 'Extract from /product/{shopId}/{itemId} URL');

    const testUrl3 = 'https://shopee.vn/item?itemid=555444&shopid=333222';
    const ext3 = extractShopeeIds(testUrl3);
    assert(ext3.shopId === '333222' && ext3.itemId === '555444', 'Extract from URL query params');

    // -------------------------------------------------------------------------
    // TEST 2: calculateTimeScore
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing calculateTimeScore ---');
    const tClick = '2026-08-19 10:00:00';
    const tOrderClose = '2026-08-19 10:03:00'; // 3 mins -> +30
    const sc1 = calculateTimeScore(tClick, tOrderClose, 120);
    assert(sc1.points === 30 && sc1.isValid === true, 'Time score <= 5 mins gives +30 points');

    const tOrder30m = '2026-08-19 10:25:00'; // 25 mins -> +20
    const sc2 = calculateTimeScore(tClick, tOrder30m, 120);
    assert(sc2.points === 20 && sc2.isValid === true, 'Time score 25 mins gives +20 points');

    const tOrderOut = '2026-08-19 14:00:00'; // 4 hours -> 0 (outside window)
    const sc3 = calculateTimeScore(tClick, tOrderOut, 120);
    assert(sc3.isValid === false && sc3.points === 0, 'Time outside window gives 0 points & isValid=false');

    // -------------------------------------------------------------------------
    // TEST 3: METHOD 1 — SUB_ID MATCH (Priority 1, Score 100)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Method 1: Sub_ID Matching ---');
    const mockClickId1 = 'CLK_SUB_TEST_001';
    const mockSubId1 = 'SUB_USR101_CLICK_01';
    
    // Insert mock click
    await db.run(
      `INSERT OR REPLACE INTO affiliate_clicks (id, user_id, click_id, sub_id, item_id, shop_id, origin_url, clicked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mockClickId1, 'USR101', mockClickId1, mockSubId1, '111222', '333444', 'https://shopee.vn/test', '2026-08-19 09:00:00']
    );

    const orderSubIdMatch = {
      order_id: 'ORD_SUB_001',
      checkout_id: 'CHK_001',
      item_id: '999999', // Different item_id
      shop_id: '888888', // Different shop_id
      order_time: '2026-08-19 12:00:00',
      shopee_click_time: '2026-08-19 09:00:00',
      commission: 50000,
      shopee_status: 'Đang chờ xử lý',
      sub_id1: mockSubId1,
      sub_id2: '',
      sub_id3: '',
      sub_id4: '',
      sub_id5: ''
    };

    const resSub = await matchOrder(orderSubIdMatch, db);
    assert(resSub.status === 'CONFIRMED', 'Sub_ID match gives status CONFIRMED');
    assert(resSub.matchedBy === 'SUB_ID', 'Sub_ID match gives matchedBy SUB_ID');
    assert(resSub.matchScore === 100, 'Sub_ID match gives matchScore 100');
    assert(resSub.userId === 'USR101', 'Sub_ID match identifies correct userId USR101');

    // -------------------------------------------------------------------------
    // TEST 4: METHOD 2 — ITEM_ID + SHOP_ID + TIME FALLBACK (Score >= 80)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Method 2: Fallback Item + Shop + Time Matching ---');
    const mockClickId2 = 'CLK_FALLBACK_002';
    await db.run(
      `INSERT OR REPLACE INTO affiliate_clicks (id, user_id, click_id, sub_id, item_id, shop_id, origin_url, clicked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mockClickId2, 'USR101', mockClickId2, 'CLK_FALLBACK_002', '555111', '777222', 'https://shopee.vn/product', '2026-08-19 10:00:00']
    );

    const orderFallbackMatch = {
      order_id: 'ORD_FALLBACK_002',
      checkout_id: 'CHK_002',
      item_id: '555111', // Exact item_id (+40)
      shop_id: '777222', // Exact shop_id (+30)
      order_time: '2026-08-19 10:08:00',
      shopee_click_time: '2026-08-19 10:02:00', // Time diff 2 mins (+30) -> Total = 100
      commission: 30000,
      shopee_status: 'Đang chờ xử lý',
      sub_id1: '',
      sub_id2: '',
      sub_id3: '',
      sub_id4: '',
      sub_id5: ''
    };

    const resFallback = await matchOrder(orderFallbackMatch, db);
    assert(resFallback.status === 'CONFIRMED', 'Fallback match gives status CONFIRMED');
    assert(resFallback.matchedBy === 'ITEM_SHOP_TIME', 'Fallback match gives matchedBy ITEM_SHOP_TIME');
    assert(resFallback.matchScore >= 80, `Fallback match score >= 80 (Actual: ${resFallback.matchScore})`);
    assert(resFallback.userId === 'USR101', 'Fallback match identifies correct userId USR101');

    // -------------------------------------------------------------------------
    // TEST 5: AMBIGUOUS CANDIDATES (NEED_REVIEW)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Safety Rule: Ambiguous Candidates (NEED_REVIEW) ---');
    const mockClickA = 'CLK_AMB_A';
    const mockClickB = 'CLK_AMB_B';

    await db.run(
      `INSERT OR REPLACE INTO affiliate_clicks (id, user_id, click_id, sub_id, item_id, shop_id, origin_url, clicked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mockClickA, 'USR101', mockClickA, mockClickA, '888999', '444555', 'https://shopee.vn/amb1', '2026-08-19 11:00:00']
    );

    await db.run(
      `INSERT OR REPLACE INTO affiliate_clicks (id, user_id, click_id, sub_id, item_id, shop_id, origin_url, clicked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mockClickB, 'ADM001', mockClickB, mockClickB, '888999', '444555', 'https://shopee.vn/amb2', '2026-08-19 11:02:00']
    );

    const orderAmbiguous = {
      order_id: 'ORD_AMB_003',
      checkout_id: 'CHK_003',
      item_id: '888999',
      shop_id: '444555',
      order_time: '2026-08-19 11:05:00',
      shopee_click_time: '2026-08-19 11:01:00',
      commission: 20000,
      shopee_status: 'Đang chờ xử lý',
      sub_id1: '',
      sub_id2: '',
      sub_id3: '',
      sub_id4: '',
      sub_id5: ''
    };

    const resAmb = await matchOrder(orderAmbiguous, db);
    assert(resAmb.status === 'NEED_REVIEW', 'Ambiguous candidates result in status NEED_REVIEW');
    assert(resAmb.userId === null, 'Ambiguous candidates do NOT assign random userId (userId = null)');
    assert(resAmb.candidates.length >= 2, 'Candidates list contains both eligible users');

    // -------------------------------------------------------------------------
    // TEST 6: UNMATCHED ORDER
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Unmatched Order ---');
    const orderUnmatched = {
      order_id: 'ORD_UNMATCH_004',
      checkout_id: 'CHK_004',
      item_id: '000000',
      shop_id: '000000',
      order_time: '2026-08-19 15:00:00',
      shopee_click_time: '2026-08-19 15:00:00',
      commission: 10000,
      shopee_status: 'Đang chờ xử lý',
      sub_id1: '',
      sub_id2: '',
      sub_id3: '',
      sub_id4: '',
      sub_id5: ''
    };

    const resUnmatched = await matchOrder(orderUnmatched, db);
    assert(resUnmatched.status === 'UNMATCHED', 'No candidates results in status UNMATCHED');
    assert(resUnmatched.userId === null, 'Unmatched order has userId null');

    // -------------------------------------------------------------------------
    // TEST 7: FINANCIAL SAFETY & WALLET CREDITING
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Financial Safety & Payout Rules ---');
    
    // User initial balance
    const userBefore = await db.get('SELECT balance FROM users WHERE id = ?', ['USR101']);
    const initBal = userBefore ? userBefore.balance : 0;

    // Case 7.1: Order is NEED_REVIEW -> No balance credited
    const resCredit1 = await creditUserCashbackIfEligible({
      order_id: 'ORD_SAFETY_01',
      user_id: null,
      commission: 100000,
      shopee_status: 'Hoàn thành',
      status: 'NEED_REVIEW'
    }, db);
    assert(resCredit1.credited === false, 'Do not credit wallet when status is NEED_REVIEW');

    // Case 7.2: Order is CONFIRMED but Shopee status is pending -> No balance credited
    const resCredit2 = await creditUserCashbackIfEligible({
      order_id: 'ORD_SAFETY_02',
      user_id: 'USR101',
      commission: 100000,
      shopee_status: 'Đang chờ xử lý',
      status: 'CONFIRMED'
    }, db);
    assert(resCredit2.credited === false, 'Do not credit wallet when Shopee status is pending');

    // Case 7.3: Order is CONFIRMED and Shopee status is approved/completed -> Balance credited!
    const resCredit3 = await creditUserCashbackIfEligible({
      order_id: 'ORD_SAFETY_03',
      user_id: 'USR101',
      commission: 100000, // 50% cashback = 50,000đ
      shopee_status: 'Hoàn thành',
      status: 'CONFIRMED'
    }, db);
    assert(resCredit3.credited === true && resCredit3.cashback === 50000, 'Credit wallet 50,000đ when CONFIRMED + approved');

    const userAfter = await db.get('SELECT balance FROM users WHERE id = ?', ['USR101']);
    assert(userAfter.balance === initBal + 50000, 'User balance increased exactly by +50,000đ');

    // -------------------------------------------------------------------------
    // TEST 8: ADMIN MANUAL CONFIRMATION & AUDIT LOG
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Admin Manual Confirmation & Audit Logs ---');
    
    // Insert a NEED_REVIEW order into affiliate_orders
    await db.run(
      `INSERT OR REPLACE INTO affiliate_orders (
         id, order_id, user_id, item_id, shop_id, order_time, commission, shopee_status, status, matched_by, match_score
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['AFF_TEST_MANUAL_01', 'ORD_MANUAL_999', null, '888999', '444555', '2026-08-19 11:05:00', 40000, 'Hoàn thành', 'NEED_REVIEW', null, null]
    );

    // Mock Admin confirm request
    const mockReq = {
      params: { orderId: 'ORD_MANUAL_999' },
      body: { userId: 'USR101', notes: 'Admin xác nhận thủ công sau đối chiếu' },
      user: { id: 'ADM001', role: 'admin' }
    };
    let responseData = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => { responseData = { code, ...data }; return responseData; }
      }),
      json: (data) => { responseData = { code: 200, ...data }; return responseData; }
    };

    await confirmAffiliateOrder(mockReq, mockRes);
    assert(responseData && responseData.success === true, 'Admin manual confirm API returns success');

    const confirmedOrder = await db.get('SELECT * FROM affiliate_orders WHERE order_id = ?', ['ORD_MANUAL_999']);
    assert(confirmedOrder.status === 'CONFIRMED_MANUAL', 'Order status updated to CONFIRMED_MANUAL');
    assert(confirmedOrder.matched_by === 'MANUAL', 'Order matched_by updated to MANUAL');
    assert(confirmedOrder.user_id === 'USR101', 'Order user_id assigned to USR101');

    const auditLog = await db.get('SELECT * FROM order_match_audit_logs WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', ['ORD_MANUAL_999']);
    assert(auditLog && auditLog.action === 'CONFIRMED_MANUAL', 'Audit log created with action CONFIRMED_MANUAL');
    assert(auditLog.admin_id === 'ADM001' && auditLog.new_user_id === 'USR101', 'Audit log records admin_id and new_user_id');

    // -------------------------------------------------------------------------
    // TEST 9: REAL CSV FILE BATCH MATCHING TEST
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Real CSV Report Batch Parsing ---');
    const csvPath = path.resolve(__dirname, 'AffiliateCommissionReport_202607091002.csv');
    if (fs.existsSync(csvPath)) {
      const rows = [];
      await new Promise((res, rej) => {
        fs.createReadStream(csvPath)
          .pipe(csv())
          .on('data', r => rows.push(r))
          .on('end', res)
          .on('error', rej);
      });
      console.log(`Parsed ${rows.length} rows from sample Affiliate CSV report.`);
      assert(rows.length > 0, 'Successfully parsed sample Shopee Affiliate CSV report');
    }

    // Automated test data cleanup
    const testIds = ['ORD_MANUAL_999', 'ORD_SYNC_TEST_1787131817882', 'ORD_SUB_001', 'ORD_FALLBACK_002', 'ORD_AMB_003', 'ORD_UNMATCH_004', 'ORD_SAFETY_01', 'ORD_SAFETY_02', 'ORD_SAFETY_03'];
    const p = testIds.map(() => '?').join(',');
    await db.run(`DELETE FROM orders WHERE id IN (${p}) OR id LIKE 'ORD_%'`, testIds);
    await db.run(`DELETE FROM affiliate_orders WHERE order_id IN (${p}) OR id IN (${p}) OR order_id LIKE 'ORD_%'`, [...testIds, ...testIds]);
    await db.run(`DELETE FROM order_match_audit_logs WHERE order_id IN (${p}) OR order_id LIKE 'ORD_%'`, testIds);
    await db.run("DELETE FROM affiliate_clicks WHERE click_id LIKE 'CLK_SUB_TEST_%' OR click_id LIKE 'CLK_FALLBACK_%' OR click_id LIKE 'CLK_AMB_%'");
    await db.run("UPDATE users SET balance = 0, total_cashback = 0, pending_cashback = 0 WHERE id = 'USR101'");

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ Test suite encountered an error:', error);
    process.exit(1);
  }
}

runTests();
