const getHostName = function (url) {
  const urlString = url;
  const hostname = urlString.match(/^https?:\/\/([^:]+)/)[1]; // 使用正则表达式匹配协议后的第一个非冒号部分
  // console.log(hostname); // 输出: www.example.com
  return hostname;
}

module.exports = {
  getHostName
}
