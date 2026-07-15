const express = require("express");

const router = express.Router();
// 引入token
const vertoken = require('../../token');

const utils = require('../../utils/index');


/* user login. */
router.post("/", (req, res) => {
  // 获取参数
  const params = [];
  params[0] = req.body.username;
  params[1] = req.body.password;
  console.log('user:', utils.getHostName(req.get('origin')), params[0]);
  if (!params[0] || !params[1]) {
    return res.send({
      code: -1,
      message: '账户或密码不能为空'
    });
  } else {
    if ((params[0] === 'admin' || params[0] === 'third' || params[0] === 'liming') && params[1] === '1') {
      vertoken.setToken(params[0], params[1]).then(
        (token) => {
          res.cookie('USER', params[0], {
            domain: utils.getHostName(req.get('origin')), // 设置生效域名
            httpOnly: true, // 只运行Http访问
            maxAge: 1000 * 60 * 60 * 8 // 2个小时过期
          });
          return res.send({
            code: 200,
            message: '登录成功',
            data: token
            // 前端获取token后存储在localStroage中,
            // **调用接口时 设置axios(ajax)请求头Authorization的格式为`Bearer ` +token
          });
        },
        (error) => {
          console.log(123)
          return res.send({
            code: 200,
            message: '登录失败'
            // 前端获取token后存储在localStroage中,
            //* *调用接口时 设置axios(ajax)请求头Authorization的格式为`Bearer ` +token
          });
        }
      )
    } else {
      res.status(200).send({
        code: -1,
        message: '账户或密码不正确'
      });
    }
  }
});

module.exports = router;
