export let counter = 3;
export let data = { a: 3 }
export function incCounter() {
  counter++;
}
export function returnObj() {
  let data = { a: 1 }
  function add() {
    data.a += 1;
  }
  return {
    add,
    data
  }
}