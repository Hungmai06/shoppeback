const fs = require('fs');
const path = require('path');
const reconciliationController = require('../Backend/src/controllers/reconciliationController');

async function testApply() {
  const uploadsDir = path.resolve(__dirname, '../Backend/uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const tempFileName = `test_excel_date_${Date.now()}.csv`;
  const tempFilePath = path.join(uploadsDir, tempFileName);

  const csvContent = `ID đơn hàng\tTrạng thái đặt hàng\tThời Gian Đặt Hàng\tTên Item\tGiá trị đơn hàng (₫)\tHoa hồng ròng tiếp thị liên kết(₫)
TEST_DATE_ORDER_123\tHoàn thành\t46275.93922453704\tSản phẩm test date\t100000\t5000`;

  fs.writeFileSync(tempFilePath, csvContent, 'utf8');

  console.log('Testing apply with Excel float date timestamp...');
  const reqApplyMock = {
    body: { tempFileName }
  };
  const resApplyMock = {
    json: (data) => console.log('SUCCESS:', data),
    status: (code) => ({ json: (err) => console.error('ERROR:', code, err) })
  };

  await reconciliationController.applyReconciliation(reqApplyMock, resApplyMock);
}

testApply();
