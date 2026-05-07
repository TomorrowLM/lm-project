import { counter, incCounter, returnObj } from './copy';
// console.log(counter); // 3
// incCounter();
// console.log(counter); // 4


const { add, data } = returnObj();
console.log('init',data.a);
add();
console.log('add',data.a);