//创建一个express应用程序
var  express = require('express');
var app = express();
// 解决跨域问题
app.all("/*", function(req, res, next) {
  // 跨域处理
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", ' 3.2.1');
  res.header("Content-Type", "application/json;charset=utf-8");
  next(); // 执行下一个路由
});
app.get('/1', function(req, res){
   res.send('hello world');
 });
 

 //app.set(name, value)
//将设置项 name 的值设为 value
 
var server = app.listen(8888,function(){
  var host = server.address().address;
  var port = server.address().port;
  console.log("应用实例，访问地址为 http://%s:%s", host, port)
});