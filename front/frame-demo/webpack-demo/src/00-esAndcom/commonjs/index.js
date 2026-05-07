// main.js
var mod = require('./copy');

console.log('init',mod.counter);  // 1
mod.incCounter();
//内部变化影响不到输出的mod.counter
console.log('add',mod.counter); // 1