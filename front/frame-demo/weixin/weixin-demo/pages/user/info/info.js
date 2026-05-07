// pages/user/info.js
const app=  getApp()
// var appInstance = getApp()
// console.log(app.globalData.id), // I am global data
Page({
   /**
   * 1.wx:for ={{list}}  默认情况下,可以直接使用item变量,index变量,这个微信小程序自带的设置
   * 2.如果想要替换for循环中的item则需要设置wx:for-item=新的变量名字, wx:for-index=新的索引变量名
   * 3.wx:if={{bool}} 也有wx:else 的写法,
   * 4.其实在花括号中写得也是一段代码,那也就是说花括号中可以做三元运算
   * 5.在微信小程序中, 如果要定义变量需要在data属性中统一定义
   * 6.如果要配置全局的设置比如说,tabbar,页面title表现,title的背景色,需要在app.json中配置,app.json是全局的配置文件,
   * 7.如果要配置单个页面的配置,比如单个页面的title文字,title背景,下拉刷新,则需要在单个页面的json文件中配置
   * 8.scroll-view 当一个容器需要出滚动条时,需要用scroll-view标签替换view标签,因为scroll-view有较好的滚动条支持
   * 9.picker 标签可以快捷的生成一个选择器,可以设置的内容有,时间日期,三级联动选择
   * 10.page-container 标签可以快捷的生成一个抽屉,用于筛选功能
   * 11.swiper 需要和swiper-item联合使用,swiper有默认高,使用时需要设置
   * 12. image 标签有默认宽高 320*240,在使用image标签时需要设置mode属性来改变默认值 heightFix 高度不变宽度自适应, widthFix 宽度不变,高度自适应
   * 13.路由api  wx.switchTab 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面 
   *             wx.navigateTo 保留当前页面，跳转到应用内的某个页面。但是不能跳到 tabbar 页面。最多十层。
   *              wx.navigateBack  关闭当前页面，返回上一页面或多级页面。
   * 14.微信小程序没有嵌套路由
   * 15.微信小程序只能用get的形式带参数,接收参数的页面的onLoad生命周期函数中接收一个变量,这个变量接收的就是路由携带过来的参数,跳转babbar页面不可以使用这个方式携带参数,可以用全局变量或者缓存来实现tabbar页面的参数传递
   * 16. 文档这总app()这个方法,指的是app.js中的app()方法,默认情况下小程序已经创建了这个方法无需再次创建
   * 17.在微信小程序中,如果要定义全局变量,需要在app.js的globalData属性中设置,要使用或者重新对全局变量赋值时需要在当前页面的js文件中,先调用getApp()方法获得app实例,设置时只需要赋值就可以了:app.globalData.id=12,使用时直接输出即可:app.globalData.id
   * 18.微信小程序中定义的全局变量,不要输出到wxml文件中,如果要输出全局变量到wxml文件中,需要在对应的js文件中,定义一个变量去接收全局变量
   * 19.  wx.setStorageSync('id', 16)可以同步设置一个缓存,   wx.getStorageSync('id')同步获取一个缓存
   * 20.在微信小程序中,如果要定义一个函数,那么就在data和onload的同等级下定义即可
   * 21.在微信小程序的页面的js文件中如果要使用当前页面的函数用法是,this.函数名(),
   * 22.在微信小程序的页面的js文件中如果要使用当前页面的变量用法是:this.data.变量名字
   * 23.在修改一个变量时,如果只是想要设置他的值,不想要响应到wxml页面上,那么只需要赋值即可,this.data.变量名=新值,但是如果想要响应的更改wxml里面的内容,则需要用到setData
   *        用法是:this.setData({
   *                  变量名:新值
   *                })
   * 24.在wxml页面如果要绑定点击事件,需要设置标签对bindtap属性值,bindtap属性接收的是一个函数名且只能是函数名不能加()
   * 25.在触发事件时,如果想要携带参数,需要在正在触发事件的标签上按如下格式写参数,data-键名=参数值, "data-"为固定写法,键名可以随意定义,值可以是变量渲染来的
   *                接收参数时,触发函数会接收到当前标签的dom实例,这这个实例中,currentTarget.dataset属性是携带过来的参数值
   *26.微信小程序中,建议使用表单获取用户输入
   *27. 在使用radio的时候建议使用radio-group 将radio包裹起来,这样可以实现单选,且当有多个radio元素时,可以快捷的获取选中的元素值,radio标签没有change事件,但是radio-group有chagne事件
    *28.checkbox和radio的用法大致相同
      29.input框的type属性可以设置呼出的软键盘的类型,text(中英文)/number(数字)/idcard(身份证)/safe-password(密码)
      30.input框可以通过设置focus为true,让input框获得焦点
      31.input框可以通过confirm-type属性值为:send/search/next/go/done,来设置软键盘右下角按钮的文本内容
      32.如果一个表单需要提交,那么这个表单中要有一个按钮,且这个按钮的form-type属性要为submit,同时这个form标签也需要有一个bindsubmit事件,只有这样设置当点击按钮时才会触发bindsubmit后的事件,我们才可以拿到用户是输入的值
      33.form表单中的表单元素(input,picker,radio等)都需要设置一个name属性,不然通过表单提交时无法获得这个表单元素的值
   /**
   * 页面的初始数据
   */
  data: {
        msg:" this is info page.",
        class_name:"red",
        arr:[
          {name:"1"},
          {name:"2"},
          {name:"3"},
          {name:"4"},
          {name:"5"},
        ],
        arrs:[
          "d",
          "gd"
        ],
        state:true,
        background: ['demo-text-1', 'demo-text-2', 'demo-text-3']
  },
    list(val){
      console.log(val,111111111);
      this.data.arr.push({name:"4000"})
      this.setData(
        {
          arr:this.data.arr
        }
      )
    },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // wx.switchTab({
    //   url: '/pages/home/home',
    //   fail(e){
    //     console.log(e);
    //   }
    // })
    // wx.reLaunch({
    //   url: '/pages/home/home',
    // })
    // wx.redirectTo({
    //   url: '/pages/home/home',
    // })
    // wx.navigateTo({
    //   url :'/pages/home/home?id=12',
    // })
    //存储一个全局变量用于tabbar页面之间传递参数
    app.globalData.id=13
    //存储一个缓存,用于tabbar页面之间传递参数
    wx.setStorageSync('id', 16)
    // wx.switchTab({
    //   url: '/pages/logs/logs',
    // })
        wx.request({
          url: 'http://api_devs.wanxikeji.cn/api/goodList',
          method:"post",
          data:{
            size:2
          },
          success(res){
            console.log(res)
          }
        })
  },
  check(e){
    console.log("check")
    console.log(this.data.arrs);
    this.data.msg="hello word!"//非响应式
    this.setData({//响应式
      msg:"hello word!"
    })
    console.log(this.data.msg);
    if(e){
      console.log(e.currentTarget.dataset);
    }
  },
  submit(e){
    console.log(e);
  },
  radioChange(e){
    console.log(e);
  },
  checkboxChange(e){
    console.log(e);
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
      this.check()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})