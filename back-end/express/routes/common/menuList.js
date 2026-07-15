const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get('/', (req, res, next) => {
  console.log(req.cookies);
  const data = req.cookies.USER === 'admin'
    ? {
      routes: [{
        path: '/',
        children: [
          {
            path: 'demo',
            name: 'demo',
            meta: {
              sidebar: true,
              menuName: 'demo'
            },
            component: 'demo/index.vue',
            children: [
              {
                path: 'access',
                name: 'access',
                component: 'demo/Access/index.vue',
                meta: {
                  sidebar: true,
                  menuName: '权限',
                  button: {
                    'btn:createUser': 2, // 显示
                    'btn:editUser': 2, // 显示
                    'module:module1': 2// 显示
                  },
                  roles: ['admin', 'liming']
                }
              }
            ]
          }
        ]
      }]
    }
    : req.cookies.USER === 'liming' ? {
      routes: [{
        path: '/',
        children: [
          {
            path: 'demo',
            name: 'demo',
            meta: {
              sidebar: true,
              menuName: 'demo'
            },
            component: 'demo/index.vue',
            children: [
              {
                path: 'access',
                name: 'access',
                component: 'demo/Access/index.vue',
                meta: {
                  sidebar: true,
                  menuName: '权限',
                  button: {
                    'btn:createUser': 1, // 禁用
                    'btn:editUser': 0, // 隐藏
                    'module:module1': 2// 显示
                  },
                  roles: ['admin', 'liming']
                }
              }
            ]
          }
        ]
      }]
    }
      : {
        routes: []
      }
  res.send({
    code: 200,
    message: 'success',
    data: {
      ...data
    }
  });
});

module.exports = router;
