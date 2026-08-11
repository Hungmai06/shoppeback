const { getDatabase } = require('./src/config/db');

async function test() {
  try {
    const db = await getDatabase();
    console.log('Connected to database.');
    
    // Test a basic select
    const users = await db.all('SELECT id FROM users LIMIT 2');
    console.log('Users:', users);

    // Test transaction wrapper
    console.log('Starting transaction...');
    await db.run('BEGIN TRANSACTION');
    
    console.log('Inserting mock order...');
    const mockOrderId = 'TEST_ORDER_' + Date.now();
    await db.run(
      `INSERT INTO orders (id, user_id, product_name, product_image, order_amount, estimated_cashback, real_cashback, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        mockOrderId,
        null,
        'Test Product',
        'http://example.com/img.jpg',
        100000,
        7000,
        7000,
        'pending',
        '2026-07-06 14:15:00'
      ]
    );
    console.log('Mock order inserted.');

    console.log('Committing transaction...');
    await db.run('COMMIT');
    console.log('Transaction committed successfully.');
    
    // Clean up
    await db.run('DELETE FROM orders WHERE id = ?', [mockOrderId]);
    console.log('Mock order cleaned up.');
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
