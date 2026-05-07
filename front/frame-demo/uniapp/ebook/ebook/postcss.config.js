const path = require('path')
module.exports = {
  parser: require('postcss-comment'),
  plugins: [
    require('postcss-import')({
      resolve (id, basedir, importOptions) {
        if (id.startsWith('~@/')) {
          return path.resolve(process.env.UNI_INPUT_DIR, id.substr(3))
        } else if (id.startsWith('@/')) {
          return path.resolve(process.env.UNI_INPUT_DIR, id.substr(2))
        } else if (id.startsWith('/') && !id.startsWith('//')) {
          return path.resolve(process.env.UNI_INPUT_DIR, id.substr(1))
        }
        return id
      }
    }),
    // require('autoprefixer')({
    //   // remove: process.env.UNI_PLATFORM !== 'h5'
    // }),
    
    require('@dcloudio/vue-cli-plugin-uni/packages/postcss'),
  //   require('postcss-pxtorem')({
  //     // 把px单位换算成rem单位
  //     rootValue: 75, // // 设计稿宽度的1/10
  //     selectorBlackList: ['weui', 'mu'], // 忽略转换正则匹配项
  //     propList: ['*'] // 需要做转化处理的属性，如`hight`、`width`、`margin`等，`*`表示全部
  // })
  ]
}
