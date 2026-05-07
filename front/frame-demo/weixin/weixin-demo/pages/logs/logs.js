// logs.js
const util = require('../../utils/util.js')
const app=getApp()
Page({
  data: {
    logs: [],
    ids:""
  },
  onLoad(op) {
    console.log(op);
    //接收全局变量携带过来的参数
    console.log(app.globalData.ids);
    this.data.ids=app.globalData.ids
    //接收缓存携带过来的参数
    console.log(wx.getStorageSync('id'),7848567564565555);
    // console.log(this.data.ids)
    app.show()
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map(log => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log
        }
      })
    })
  }
})
