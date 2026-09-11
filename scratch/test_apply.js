const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../Backend/src/config/db');

// Import controller functions
const reconciliationController = require('../Backend/src/controllers/reconciliationController');

async function runTest() {
  try {
    const db = await getDatabase();
    console.log('Database connected.');

    const sampleCsv = `ID đơn hàng\tTrạng thái đặt hàng\tCheckout id\tThời Gian Đặt Hàng\tThời gian hoàn thành\tThời gian Click\tTên Shop\tShop id\tLoại Shop\tItem id\tTên Item\tID Model\tLoại sản phẩm\tPromotion id\tL1 Danh mục toàn cầu\tL2 Danh mục toàn cầu\tL3 Danh mục toàn cầu\tGiá(₫)\tSố lượng\tLoại Hoa hồng\tĐối tác chiến dịchr\tGiá trị đơn hàng (₫)\tSố tiền hoàn trả (₫)\tTỷ lệ sản phẩm hoa hồng Shope\tHoa hồng Shopee trên sản phẩm(₫)\tTỷ lệ sản phẩm hoa hồng người bán\tHoa hồng Xtra trên sản phẩm(₫)\tTổng hoa hồng sản phẩm(₫)\tHoa hồng đơn hàng từ Shopee(₫)\tHoa hồng đơn hàng từ Người bán(₫)\tTổng hoa hồng đơn hàng(₫)\tTên MNC đã liên kết\tMã hợp đồng MCN\tMức phí quản lý MCN\tPhí quản lý MCN(₫)\tMức hoa hồng tiếp thị liên kết theo thỏa thuận\tHoa hồng ròng tiếp thị liên kết(₫)\tTrạng thái sản phẩm liên kết\tGhi chú sản phẩm\tLoại thuộc tính\tTrạng thái người mua\tSub_id1\tSub_id2\tSub_id3\tSub_id4\tSub_id5\tKênh\tContent Type
260910NWSFMB0W\tĐang chờ xử lý\t2.42754E+14\t9/10/2026 22:32\t\t9/10/2026 22:29\thieu.tv\t899392524\tC2C(Non-CB)\t58114516949\t[Rẻ Vô Địch] combo 5 Khung đèn ông sao trơn\t4.41248E+11\tNormal Product\t\tNhà cửa & Đời sống\tĐèn\t\t20000\t2\tShopee Comm\t\t40000\t\t2.50%\t1000\t0.00%\t0\t1000\t2175\t0\t2175\t\t0\t0.00%\t0\t100.00%\t2175\tĐang chờ xử lý\tTrạng thái của sản phẩm\tĐơn hàng từ các Shop khác\tĐã tồn tại\tCLK17890541480500jsjwp\t\t\t\t\tWebsites\t
260907C2PPMDSJ\tHoàn thành\t2.42415E+14\t9/7/2026 0:33\t9/10/2026 18:26\t9/5/2026 19:34\tDK HARVEST OFFICIAL STORE\t273650958\tShopee Mall(Non-CB)\t42132654077\tGLOW BASIC Combo: Yến mạch\t2.92791E+11\tNormal Product\t\tThực phẩm và đồ uống\tNgũ cốc\tNgũ cốc\t88000\t1\tXTRA Comm\t\t60445\t\t2.50%\t1511.125\t4.00%\t2417.8\t3928.925\t1511.125\t2417.8\t3928.925\t\t0\t0.00%\t0\t100.00%\t3928.925\tHoàn thành\t\tĐơn hàng từ các Shop khác\tĐã tồn tại\t\t\t\t\t\tGoogle Search\t`;

    const uploadsDir = path.resolve(__dirname, '../Backend/uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const tempFileName = `test_upload_${Date.now()}.csv`;
    const tempFilePath = path.join(uploadsDir, tempFileName);
    fs.writeFileSync(tempFilePath, sampleCsv, 'utf8');

    console.log('Testing uploadAndAnalyze...');
    const reqMock = {
      file: {
        path: tempFilePath,
        filename: tempFileName,
        originalname: 'test_sample.csv'
      }
    };
    const resMockUpload = {
      json: (data) => {
        console.log('Upload Result:', JSON.stringify(data, null, 2));
      },
      status: (code) => ({ json: (err) => console.error('Upload Error Status:', code, err) })
    };

    await reconciliationController.uploadAndAnalyze(reqMock, resMockMock = resMockUpload);

    console.log('\nTesting applyReconciliation...');
    const reqApplyMock = {
      body: { tempFileName }
    };
    const resApplyMock = {
      json: (data) => {
        console.log('Apply Result:', JSON.stringify(data, null, 2));
      },
      status: (code) => ({ json: (err) => console.error('Apply Error Status:', code, err) })
    };

    await reconciliationController.applyReconciliation(reqApplyMock, resApplyMock);

    process.exit(0);
  } catch (err) {
    console.error('Test script exception:', err);
    process.exit(1);
  }
}

runTest();
