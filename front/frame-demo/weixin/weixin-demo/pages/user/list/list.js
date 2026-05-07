// pages/user/list/list.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    list:[
      {
        title:"A",
        children:[
          {
            name:"阿克苏"
          },
          {
            name:"阿联酋"
          }
        ]
      },
      {
        title:"B",
        children:[
          {
            name:"波兰"
          },
          {
            name:"北京"
          },
        ]
      },
      {
        title:"C",
        children:[
          {
            name:"重庆"
          },
          
        ]
      },
      {
        title:"G",
        children:[
          {
            name:"甘肃"
          },
          {
            name:"广东"
          },
          {
            name:"广西"
          },
          {
            name:"贵州"
          },
        ]
      },
      {
        title:"H",
        children:[
          {
            name:"河南"
          },
          {
            name:"河北"
          },
          {
            name:"黑龙江"
          },
          {
            name:"湖北"
          },
          {
            name:"湖南"
          },
          {
            name:"海南"
          },
        ]
      },
      {
        title:"J",
        children:[
          {
            name:"吉林"
          },
          {
            name:"江苏"
          }
        ]
      },
      {
        title:"S",
        children:[
          {
            name:"山东"
          },
          {
            name:"山西"
          },
          {
            name:"上海"
          },
          {
            name:"上陕西"
          }
        ]
      },
    ],
    current: {
      title:"A",
      children:[
        {
          name:"阿克苏"
        },
        {
          name:"阿联酋"
        }
      ]
    },
    menu_id:'',
    nodes_info:[],
    time:null
  },
  changeMenu(e){
    this.setData({
      current:this.data.list[e.currentTarget.dataset.index],
      menu_id:"id"+this.data.list[e.currentTarget.dataset.index].title
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
  let that=this
    const query = wx.createSelectorQuery()
    query.selectAll(".menu-item").fields({
      rect: true,
    }, function (res) {
      that.data.nodes_info=res
        // console.log(res);

    }).exec()
  },
scroll(e){

  if(this.data.time){
    clearTimeout(this.data.time)
  }
  this.data.time=setTimeout(()=>{
    let top=e.detail.scrollTop+21
    let nodes_info=this.data.nodes_info
    console.log(11)
    for(var i=0;i<nodes_info.length-2;i++){
      if(top>=nodes_info[i].top&&top<nodes_info[i+1].top){
        this.setData({
          current:this.data.list[i]
        })
      }
    }
  },1000)
  
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