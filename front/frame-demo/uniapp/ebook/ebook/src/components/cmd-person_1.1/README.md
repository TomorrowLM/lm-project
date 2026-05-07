### cmd组件制作个人中心模板    

使用雷电模拟器演示APP、微信开发者工具演示微信小程序、猎豹浏览器演示H5。    
使用白色顶部导航栏所有看不到状态栏文字，具体还看真机运行效果。    
可以作为项目模板基础，对于初学vue新手入uni-app友好，代码操作注释明确。    
适用于uni-app项目的``cmd``组件写法基础，易于理解vue组件的创建使用，代码操作注释明确不混乱，可自行修改代码样式。    
样式修改可以通过H5方式运行后查看浏览器开发者工具，有css基础都很好理解。    
推荐新手先看看这篇[白话uni-app](http://ask.dcloud.net.cn/article/35657)    
自定义导航后下拉刷新问题可以看看[mescroll -支持uni-app的下拉刷新上拉加载组件](http://ext.dcloud.net.cn/plugin?id=343)    
默认使用新版编译器环境[uni-app 1.9发布，App平台升级为新版编译器（自定义组件模式），支持更多Vue语法](https://ask.dcloud.net.cn/article/35818)    

**所需组件：**    

* 动画组件名：``cmd-transition`` 代码块： cmdTransition
* 头像组件名：``cmd-avatar`` 代码块： cmdAvatar
* 底部导航栏组件名：``cmd-bottom-nav`` 代码块： cmdBottomNav
* 列表单元组件名：``cmd-cell-item`` 代码块： cmdCellItem
* icon图标组件名：``cmd-icon`` 代码块： cmdIcon
* 输入框组件名：``cmd-input`` 代码块： cmdInput
* 导航栏组件名：``cmd-nav-bar`` 代码块： cmdNavBar
* 导航栏内容页组件名：``cmd-page-body`` 代码块： cmdPageBody    

使用自定义导航栏时
```json
{
  // 全局bar样式中去除，顶部导航条、滚动条、原生回弹阴影
  "globalStyle": {
  	// 不显示工具栏toolbar
  	"navigationStyle": "custom",
  	"app-plus": {
  		// 不显示滚动条
  		"scrollIndicator": "none",
  		// 页面回弹效果
  		"bounce": "none"
  	}
  }
}
```

全局样式使用    
如果``cmd``组件在使用中发生大小异常，可以在组件内加上view标签通用样式
```css
/* 全局样式 */
@import url("./common/uni/uni.css");

/* 通用 */
view {
	font-size: 28upx;
	line-height: 1.8;
}
```

**闲谈**     

对于想开发APP的开发者在选择weex大多都感到难上手，混合开发平台也很多。
我感到最稳定的够DCloud了，从体验HTML开发页面到js调用原生操作的mui/nativejs,
现在到一套代码编到7个平台的uni-app。使用 Vue.js 开发跨平台应用的前端框架，
vue从简单指令上手到阅读[uni-app官网](https://uniapp.dcloud.io/README)的文档就可以开发简单的一套代码编到7个平台的uni-app项目。
开发后的代码在7端基本无差异，使用条件编译调整。
在性能方面，APP最好写nvue使用weex的渲染。

**祝愿DCloud越做越好**