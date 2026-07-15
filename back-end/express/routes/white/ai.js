// Please install OpenAI SDK first: `npm install openai`
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-68aa904285664809a726c358b631ee05'
});

async function main(data) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: data.mes }],
    model: "deepseek-chat"
  });

  console.log(completion.choices[0].message.content);
  return { message: completion.choices[0].message.content }
}

router.post('/', async (req, res, next) => {
  const list = [];
  // main();
  console.log(req.body);
  const { message } = await main(req.body);
  console.log(message);
  res.send({
    code: 200,
    message: 'success',
    data: { message }
  });
});

module.exports = router;