const db = require('./db');

async function printDatabases() {
  try {
    const [rows] = await db.query('SHOW DATABASES');
    console.log('数据库列表:');
    rows.forEach(row => console.log(row.Database));
  } catch (err) {
    console.error('查询数据库列表失败:', err);
  } finally {
    db.end && db.end();
  }
}

printDatabases();
