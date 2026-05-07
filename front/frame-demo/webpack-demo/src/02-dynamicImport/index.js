//动态导入模块，webpack打包时会将动态导入的模块单独打包成一个文件
setTimeout(async function () {
  //文件会等5秒后加载
  // webpackChunkName: "name"：这是webpack动态导入模块命名的方式
  const useDynamicImport = await import(
    /* webpackChunkName: "dynamicImport" */
    './dynamicImport.js')
  console.log(useDynamicImport.default(1, 2))
}, 2000)
