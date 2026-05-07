(function (graph) {
    console.log(222222
);
    function require(file) {
      //转化成绝对路径
      function absRequire(relPath) {
        return require(graph[file].deps[relPath])
      }
      //执行add.js的code时候，会遇到exports这个还没定义的问题.因此我们可以自己定义一个exports对象。
      var exports = {};
      (function (require, exports, code) {
        console.log(11111111, exports);
        //code代码执行过程中会执行到require函数。
        //这时会调用这个require，也就是我们传入的absRequire
        eval(code);
      })(absRequire, exports, graph[file].code)
      return exports;
    }
    require('./src/index.js')
  })({"./src/index.js":{"deps":{"./add.js":"./src\\add.js","./minus.js":"./src\\minus.js"},"code":"\"use strict\";\n\nvar _add = _interopRequireDefault(require(\"./add.js\"));\n\nvar _minus = require(\"./minus.js\");\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { \"default\": obj }; }\n\n//var _add = _interopRequireDefault(require(\"./add.js\"));\n//var _minus = require(\"./minus.js\");\n//function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { \"default\": obj }; }\nvar sum = (0, _add[\"default\"])(1, 2);\nvar division = (0, _minus.minus)(2, 1);\nconsole.log('sum', sum);\nconsole.log('division', division); // var sum = (0, _add[\"default\"])(1, 2);\n//var division = (0, _minus.minus)(2, 1);\n//console.log(sum);\n//console.log(division);\n//不能执行index.js这段代码的，因为浏览器不会识别执行require和exports"},"./src\\add.js":{"deps":{},"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports[\"default\"] = void 0;\n\nvar _default = function _default(a, b) {\n  return a + b;\n};\n\nexports[\"default\"] = _default;"},"./src\\minus.js":{"deps":{},"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports.minus = void 0;\n\nvar minus = function minus(a, b) {\n  return a - b;\n};\n\nexports.minus = minus;"}})