var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function (req, res, next) {
  setTimeout(() => {
    res.send({
      code: 200,
      message: 'success',
      data: {
        info: 'test'
      }
    });
  }, 2000)
});

module.exports = router;
