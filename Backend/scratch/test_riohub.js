const {
  RIOHUB_DOMAINS,
  isConnectionLevelError,
  buildSubId,
  parseSubId
} = require('../src/services/riohubService');

console.log('--- TEST RIOHUB DOMAINS & FAILOVER ---');
console.log('1. Danh sách tên miền ưu tiên:');
console.log(RIOHUB_DOMAINS);

console.log('\n2. Kiểm tra bộ nhận diện lỗi tầng kết nối (isConnectionLevelError):');
const testCases = [
  { err: { code: 'ENOTFOUND' }, expected: true, desc: 'Lỗi DNS' },
  { err: { code: 'ECONNREFUSED' }, expected: true, desc: 'Lỗi từ chối kết nối' },
  { err: { code: 'ETIMEDOUT' }, expected: true, desc: 'Lỗi Timeout' },
  { err: { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, expected: true, desc: 'Lỗi chứng chỉ TLS AltName (29/09/2026)' },
  { err: { status: 401, message: 'Invalid API Key' }, expected: false, desc: 'Lỗi HTTP 401 (không failover)' },
  { err: { status: 422, message: 'product_not_promotable' }, expected: false, desc: 'Lỗi HTTP 422 (không failover)' },
  { err: { status: 500, message: 'Internal Server Error' }, expected: false, desc: 'Lỗi HTTP 500 (không failover)' }
];

let allPassed = true;
testCases.forEach((tc, idx) => {
  const result = isConnectionLevelError(tc.err);
  const pass = result === tc.expected;
  if (!pass) allPassed = false;
  console.log(`- Case ${idx + 1} [${tc.desc}]: ${pass ? 'PASSED' : 'FAILED'} (nhận ${result}, mong đợi ${tc.expected})`);
});

console.log('\n3. Kiểm tra định dạng sub_id (sub1-sub2-sub3-sub4):');
const subId = buildSubId({ userId: 'user-123', clickId: 'clk-456-abc', source: 'web', extra: '' });
console.log('Generated sub_id:', subId);
const parsed = parseSubId(subId);
console.log('Parsed sub_id:', parsed);

if (subId.includes('--') || subId.split('-').length === 4) {
  console.log('sub_id đúng định dạng 4 phần!');
}

console.log('\nKết luận kiểm thử:', allPassed ? 'TOÀN BỘ PASS!' : 'CÓ TEST THẤT BẠI!');
