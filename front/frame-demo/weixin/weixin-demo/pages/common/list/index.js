// pages/common/llist/index.js
Component({
  /**
   * 组件的属性列表
   * 接收父组件传递过来的参数,接收参数时,需要设置接收参数的类型
   */
  properties: {
    arr:{
      type:Array,//arr变量的数据类型
      value:[
        { name:100}//当父组件不传递参数时,arr数组的默认值
      ]
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    lsit:{}
  },

  /**
   * 组件的方法列表
   * 组件要定义方法,需要在methods里面定义
   */
  methods: {
    show(e){
      // console.log(e);
      // console.log(this.data.arr);
      this.triggerEvent("myfatherList",[4545454545,111111])
    }
  },
  
})
