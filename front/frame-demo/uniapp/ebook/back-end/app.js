var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var loginRouter = require('./routes/login');
var registerRouter = require('./routes/register');
var fixzhanghaoRouter =  require('./routes/fixzhanghao');
var fixmimaRouter =  require('./routes/fixmima');
var app = express();

// view engine setup
//set方法用于指定变量的值。
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// 设定静态文件目录，比如本地文件
// 目录为back-end/public/images，访问
// 网址则显示为http://localhost:3000/images
app.use(express.static(path.join(__dirname, 'public')));

//网址的重定向 res.redirect("http://www.baidu.com");
//用于发送文件 res.sendFile("/path/to/anime.mp4");
//渲染网页模板 res.render("index", { message: "Hello World" });
//req.ip req.ip属性用于获得HTTP请求的IP地址。
//req.files req.files用于获取上传的文件。
//res.end([data] [, encoding])结束响应过程。 该方法实际上来自Node核心，特别是http.ServerResponse的response.end（）方法。用于快速结束响应，而无需任何数据。 
//res.send（）发送HTTP响应。主体参数可以是Buffer对象，String，对象或Array
// 解决跨域问题
app.all("*", function(req, res, next) {
  //设置请求头
  //允许所有来源访问
  res.header("Access-Control-Allow-Origin", "*");
   //用于判断request来自ajax还是传统请求
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
    //允许访问的方式
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
   //修改程序信息与版本
  res.header("X-Powered-By", ' 3.2.1');
  //内容类型：如果是post请求必须指定这个属性
  res.header("Content-Type", "application/json;charset=utf-8");
  next(); // 执行下一个路由
});
app.all('*', function (req, res, next) {
  //响应头指定了该响应的资源是否被允许与给定的origin共享。*表示所有域都可以访问，同时可以将*改为指定的url，表示只有指定的url可以访问到资源 
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers",  " Origin, X-Requested-With, Content-Type, Accept");
    //允许请求资源的方式
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1');
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
  });

app.use('/login', loginRouter);
app.use('/register', registerRouter);
app.use('/fixzhanghao', fixzhanghaoRouter);
app.use('/fixmima', fixmimaRouter);

//params
app.get('/:he/:she?',function(req,res) {
	if(req.params) {
    	res.end("Hello, " + req.params.she+req.params.he + ".");
	}
    else {
    	res.send("Hello, Guest.");
	}
});
app.get('/:he-:she?',function(req,res) {
	if(req.params) {
    	res.end("Hello, " + req.params.she+req.params.he + ".");
	}
    else {
      res.send("Hello, Guest.");
      
	}
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});
// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
