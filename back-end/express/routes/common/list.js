const express = require('express');
const router = express.Router();

/* GET users listing. */
router.post('/', (req, res, next) => {

  const list = [];
  const { pageSize, pageNum } = req.body.pagination
  console.log(pageSize, pageNum);

  for (let i = (pageNum - 1) * pageSize; i < pageSize * pageNum; i++) {
    list.push({
      id: i,
      name: `name${i}`
    });
  }
  console.log(list)
  res.send({
    code: 200,
    message: 'success',
    data: list
  });
});

module.exports = router;
