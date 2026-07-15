const mysql = require('mysql2');

// 创建连接池
const pool = mysql.createPool({
  host: '122.51.80.75',
  user: 'root',
  password: '123456',
  database: 'lm_database',
  port: 3306
});

module.exports = pool.promise();
