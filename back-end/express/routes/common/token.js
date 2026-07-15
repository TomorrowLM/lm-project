var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  console.log(req.user)
  res.send({
    code: 200,
    message: 'success',
    data: {
    }
  });
});

module.exports = router;
