const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get('/', (req, res, next) => {
  console.log(req.cookies);
  const data = req.cookies.USER === 'admin'
    ? {
      name: 'admin',
      role: 'admin',
    }
    : req.cookies.USER === 'liming' ? {
      name: 'liming',
      role: 'second',
    }
      : {
        name: 'third',
        role: 'third',
      }
  res.send({
    code: 200,
    message: 'success',
    data
  });
});

module.exports = router;
