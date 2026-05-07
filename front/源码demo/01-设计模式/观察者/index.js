class Observer {
  constructor(name) {
    this.name = name;
  }
  update({ taskType, taskInfo }) {
    // 假设任务分为日常route和战斗war
    if (taskType === "route") {
      console.log(`${this.name}不需要日常任务`);
      return;
    }
    this.goToTaskHome(taskInfo);
  }
  goToTaskHome(info) {
    console.log(`${this.name}去任务大殿抢${info}任务`);
  }
}

class Subject {
  constructor() {
    this.observerList = []
  }
  addObserver(observer) {
    this.observerList.push(observer);
  }
  notify(task) {
    console.log("发布五星任务");
    this.observerList.forEach(observer => observer.update(task))
  }
}

const subject = new Subject();
const stu1 = new Observer("弟子1");
const stu2 = new Observer("弟子2");

// stu1 stu2 购买五星任务通知权限
subject.addObserver(stu1);
subject.addObserver(stu2);

// 任务殿发布五星战斗任务
const warTask = {
  taskType: 'war',
  taskInfo: "猎杀时刻"
}

// 任务大殿通知购买权限弟子
subject.notify(warTask);

// 任务殿发布五星日常任务
const routeTask = {
  taskType: 'route',
  taskInfo: "种树浇水"
}

subject.notify(routeTask);

// 输出结果:
// 战斗任务
// 发布五星任务
// 弟子1去任务大殿抢猎杀时刻任务
// 弟子2去任务大殿抢猎杀时刻任务

// 日常任务
// 发布五星任务
// 弟子1不需要日常任务
// 弟子2不需要日常任务