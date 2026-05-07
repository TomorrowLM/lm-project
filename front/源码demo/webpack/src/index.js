import add from "./add.js"
//var _add = _interopRequireDefault(require("./add.js"));
import { minus } from "./minus.js";
//var _minus = require("./minus.js");
//function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

const sum = add(1, 2);
const division = minus(2, 1);
console.log('sum', sum);
console.log('division', division);
// var sum = (0, _add["default"])(1, 2);
//var division = (0, _minus.minus)(2, 1);
//console.log(sum);
//console.log(division);

//不能执行index.js这段代码的，因为浏览器不会识别执行require和exports