const mysql = require('mysql')
//创建连接  
var client = mysql.createConnection({  
  host: 'localhost',
  user: 'root',  
  password: '123456',  
  database: 'ebook' 
});  
client.connect();
 
module.exports = client;