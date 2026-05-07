const path = require("path");
const resolve = _path => path.resolve(__dirname, _path);
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
//生成创建Html入口文件
const HtmlPlugin = require('html-webpack-plugin')

console.log(process.env.NODE_ENV);
const plugins = (() => {
  const devPlugins = [
    //使用插件生成Html入口文件
    new HtmlPlugin({
      //模板文件路径
      template: "./public/index.html",
      //模板文件名
      filename: "index.html",
      minify: {
        removeAttributeQuotes: true, //删除双引号,
        // collapseWhitespace: true,    //压缩成一行，
      },
      hash: true
    }),
  ]
  if (process.env.NODE_ENV === 'development') {
    return [...devPlugins]
  }
  if (process.env.NODE_ENV === 'production') {
    // new BundleAnalyzerPlugin(),
    return [new BundleAnalyzerPlugin(), ...devPlugins]
  }
})()

module.exports = {
  mode: "development",
  devtool: "source-map",
  //虽然在webpack中允许每个页面有多个入口点，但在可能的情况下，应该避免使用多个入口点，最好使用一个入口多个引入
  //entry: { page: ['./analytics', './app'] }//这样在引入异步脚本时，会有更好的优化和一致的执行顺序。
  entry: { // 配置多入口文件
    index: './src/index.js',
    // index: {
    //   import: './src/01-multipleEntry/index.js', // 启动时需加载的模块
    //   // dependOn: 'common_chunk', // 当前入口所依赖的入口
    // },
    // another: {
    //   import: './src/01-multipleEntry/another-module.js',
    //   // dependOn: 'common_chunk',
    // },
    // common_chunk: 'lodash' // 当上面两个模块有lodash这个模块时，就提取出来并命名为common chunk
  },

  output: {
    filename: "js/[name].bundle.js",// name对应的是entry的属性名 对应index和another
    chunkFilename: "js/[name].chunk.js",//打包动态导入文件
    path: path.join(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    alias: {
      // 'lodash': 'lodash/lodash.js'
    }
  },
  devServer: {
    open: true,//初次打包完成后，自动打开浏览器
    host: '127.0.0.1',//实时打包所使用的主机地址
    port: 8800 //实时打包所使用的端口号
  },
  optimization: {
    // runtimeChunk: 'single', // 用于将运行时代码（runtime code）提取到一个单独的文件中。多个入口文件共享相同的运行时代码
    splitChunks: { // 代码分割,提取模块。但是有多个入口文件的话。文件中引入相同的模块是不会共享，需要配置runtimeChunk
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          name: 'vendors', // 打包出来的文件名
        },
        lodash: { // 针对lodash的特定规则
          test: /[\\/]node_modules[\\/]lodash[\\/]/,
          name: 'lodash', // 自定义文件名
          chunks: 'all',
        },
      },
    },
    // usedExports: false, //默认在生产环境下，webpack 会自动置为true
  },
  plugins,
  // cache: {
  //   type: 'filesystem',
  //   // cacheDirectory: path.resolve(__dirname, '.temp_cache'),
  // },
  module: {
    rules: [
      {
        test: /\.(jsx|js|ts|tsx)$/,
        exclude: /node_modules/,
        loader: "babel-loader",
        options: {
          cacheDirectory: true, //缓存，第二次打包速度会提高
          cacheCompression: false, //缓存不做压缩，打包速度也会快一点
        },
      },
    ],
  },
};