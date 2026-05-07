//‌在webpack项目中可以使用CommonJS导入导出模块，主要是因为现代JavaScript构建工具如Webpack具备模块互操作性功能，
// 允许在项目中混合使用CommonJS和ES6模块语法‌。具体来说，当使用import语法引入一个使用CommonJS导出的模块时，
// 构建工具（如Webpack）会在构建过程中自动将CommonJS模块转换为一个可以被ES6 import语法识别的格式，从而实现了两种模块系统的无缝集成‌

import cm from './commonjs.js';
console.log('commonjs', cm.useCommonjs())