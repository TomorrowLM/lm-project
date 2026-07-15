const express = require('express');
const router = express.Router();

/* GET users listing. */
router.post('/', (req, res, next) => {
  const list = [
    {
      name: '类型1',
      id: '1'
    },
    { name: '类型2', id: '2' }
  ];

  res.send({
    code: 200,
    message: 'success',
    data: list
  });
});

module.exports = router;
