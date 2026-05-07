const express = require('express');
//Express.Router是一个构造函数，调用后返回一个路由器实例。
//然后，使用该实例的HTTP动词方法，为不同的访问路径，指定回调函数；
//最后，挂载到某个路径。
var router = express.Router();
const login = require("../common/login")

router.post('/', function(req, res, next) {
    let username1 = req.body.params['username']
    let password1 = req.body.params['password']
    login(username1,password1,res);
    // connection.end();
});

//可以为将同一个路由器实例挂载到多个路径。
// router.get('/about', function(req, res) {
//   res.send('关于');
// });

module.exports = router;
