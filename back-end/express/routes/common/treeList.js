const express = require('express');
const router = express.Router();

/* GET users listing. */
router.post('/', (req, res, next) => {
  const list = [
    {
      name: 'node1',
      id: '1',
      children: [
        { name: 'node1-1', id: '1-1' },
        { name: 'node1-2', id: '1-2' }
      ]
    },
    {
      name: 'node2',
      id: '2',
      children: [
        { name: 'node2-1', id: '2-1' },
        { name: 'node2-2', id: '2-2' }
      ]
    }
  ];

  res.send({
    code: 200,
    message: 'success',
    data: list
  });
});

module.exports = router;
