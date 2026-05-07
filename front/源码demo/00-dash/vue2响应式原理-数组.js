// vue2对象响应式原理：Object.defineProperty()
// vue2数组响应式原理：覆盖可以修改数组7个方法
// 从数组原型中获取这7个方法，并覆盖为可以发送更新通知的函数实现
const originalProto = Array.prototype
const arrayProto = Object.create(originalProto);

function notifyUpdate() {
  console.log('页面更新！')
}
['push', 'pop', 'shift', 'unshift', 'splice', 'reverse', 'sort'].forEach(
  method => {
    arrayProto[method] = function () {
      // 做之前的事情
      originalProto[method].apply(this, arguments)

      // 通知更新
      notifyUpdate()
    }
  }
)

// 具体定义指定的key拦截器
function defineReactive(obj, key, val) {
  // 递归遍历
  observe(val)

  // val实际上是一个闭包
  Object.defineProperty(obj, key, {
    get() {
      return val
    },
    set(newVal) {
      if (newVal !== val) {
        // val可能是对象
        observe(newVal)
        notifyUpdate()
        val = newVal
      }
    }
  })
}
// 思想：递归遍历传入obj，定义每个属性的拦截
function observe(obj) {
  if (typeof obj !== 'object' || obj == null) {
    return obj
  }

  // 判断类型：如果是数组则替换它的原型
  if (Array.isArray(obj)) {
    Object.setPrototypeOf(obj, arrayProto)
  } else {
    const keys = Object.keys(obj)
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]
      // 对obj每个key执行拦截
      defineReactive(obj, key, obj[key])
    }
  }
}

const data = { foo: 'foo', bar: { a: 1 }, tua: [1, 2, 3] }
observe(data)
// 1.普通更新
data.foo = 'foooooooo'
// 2.嵌套属性更新
data.bar.a = 10
data.dong = 'lalala' // no ok
// 3.赋值是对象
// data.bar = {a:10}
// 4.数组
// data.tua.push(4)


// 问题分析：
// 1.需要响应化的数据较大，递归遍历性能不好、消耗较大
// 2.新增或删除属性无法监听
// 3.数组响应化需要额外实现
// 4.修改语法有限制