// 电视剧即将发布，用户订阅，发布后通知用户
class PublisherA {
  name = 'A'
  constructor() {
  }
  //方法一:发布状态,直接监听state变化
  // get state() {
  //   return '未发布';
  // }
  // set state(value) {
  //   console.log('setter: ' + value);
  // }
  // 方法二:调用发布方法
  notify() {
    this.state = '发布';
    this.listenNotify(this.name)
  }
}

// 平台
class Middleware {
  constructor() {
    this.publisherList = {}
    this.observerList = {}
    // this.middleware = { pubSubObserverList: [] };
  }
  //添加发布者
  addPublisher(publisher) {
    console.log('添加发布者', publisher.name)
    this.publisherList[publisher.name] = publisher;
    publisher.listenNotify = this.listenNotify.bind(this) // 发布者发布后调用平台的发布方法
  }
  //添加订阅者
  addObserver(type, observer) {
    console.log('添加订阅者', type, observer)
    if (!this.observerList[type]) this.observerList[type] = []
    this.observerList[type].push(observer);
  }
  // 取消订阅方法
  unsubscribe(type, cb) {
    if (this.events[type]) {
      const cbIndex = this.events[type].findIndex(e => e === cb)
      if (cbIndex != -1) {
        this.events[type].splice(cbIndex, 1);
      }
    }
    if (this.events[type].length === 0) {
      delete this.events[type];
    }
  }
  // 发布方法
  listenNotify(name) {
    console.log('平台触发订阅者更新方法');
    this.observerList[name].forEach(observer => {
      observer.update()
    });
  }
}

class Person {
  constructor(name) {
    this.name = name;
    this.lisent
  }
  update() {
    console.log('订阅者收到通知')
  }
  addObserver(emit, publisherName) {
    emit.addObserver(publisherName, this)
  }
}

// 创建平台
let emit = new Middleware();
// 创建发布者
let publisherA = new PublisherA();
// 创建订阅者
let person1 = new Person("弟子一");
let person2 = new Person("弟子二");
emit.addPublisher(publisherA);//平台添加发布者
person1.addObserver(emit, 'A')//订阅者订阅A
publisherA.notify()//发布者发布

