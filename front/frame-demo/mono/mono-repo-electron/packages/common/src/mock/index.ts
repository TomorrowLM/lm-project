/**
 * Mock配置文件
 **/
// 首先引入Mock
// const Mock = require("mockjs");
import Mock from "mockjs";

// 设置拦截ajax请求的相应时间
Mock.setup({
  timeout: "200-600",
});

let configArray: any = [];

// 遍历所有Mock文件
//对于webpack来说，可以使用require.context方法来实现文件的批量导出，但是vite搭建vue3项目时，不支持require,对于这种情况可以使用import.meta.glob或者import.meta.globEager来实现
const files = import.meta.globEager("./*/*.js");
console.log(files, 2);
// const routerContext = require.context('./', true, /index\.js$/);
// routerContext.keys().forEach((route) => {
//   // route就是路径
//   // 如果是根目录的index不做处理
//   if (route.startsWith('./index')) {
//     return;
//   }
//   const routerModule = routerContext(route);
//   routes = [...routes, ...(routerModule.default || routerModule)];
// });
console.log(Object.keys(files));
Object.keys(files).forEach((key: string) => {
  if (key === "./index.js") return;
  console.log(files[key]);
  configArray = configArray.concat((files[key] as any).default);
});
console.log(configArray);
// 注册所有的Mock服务
// configArray.forEach((item: any) => {
//   for (let [path, target] of Object.entries(item)) {
//     let protocol = path.split("|");
//     Mock.mock(new RegExp("^" + protocol[1]), protocol[0], target);
//   }
// });
configArray.forEach((item: any) => {
  console.log(item);
  Mock.mock(item.url, item.method, item.response);
});
//使用Mock下面提供的mock方法进行需要模拟数据的封装
//参数1，是需要拦截的完整请求地址，参数2，是请求方式，参数3，是请求的模拟数据
