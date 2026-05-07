# eBook

```css
npm install -g @vue/cli
```

# 创建一个项目

## 1.命令

- 运行以下命令来创建一个新项目：

  ```
  vue create hello-world
  ```

  可以选默认的包含了基本的 Babel + ESLint 设置的 preset，也可以选“手动选择特性”来选取需要的特性。

  ![CLI 预览](https://cli.vuejs.org/cli-new-project.png)

  手动设置则提供了更多的选项，它们是面向生产的项目更加需要的。

  ![CLI 预览](https://cli.vuejs.org/cli-select-features.png)

- 

  ```
  //使用uniapp模板创建项目
  vue create -p dcloudio/uni-preset-vue my-project
  ```

  ### 使用cli创建项目和使用HBuilderX可视化界面创建项目有什么区别

  - 编译器的区别
    - cli创建的项目，编译器安装在项目下。并且不会跟随HBuilderX升级。如需升级编译器，执行n**pm update**。
    - HBuilderX可视化界面创建的项目，编译器在HBuilderX的安装目录下的plugin目录，随着HBuilderX的升级会自动升级编译器。
    - 已经使用cli创建的项目，如果想继续在HBuilderX里使用，可以把工程拖到HBuilderX中。注意如果是把整个项目拖入HBuilderX，则编译时走的是项目下的编译器。如果是把src目录拖入到HBuilderX中，则走的是HBuilderX安装目录下plugin目录下的编译器。
    - cli版如果想安装less、scss、ts等编译器，需自己手动npm安装。在HBuilderX的插件管理界面安装无效，那个只作用于HBuilderX创建的项目。
  - 开发工具的区别
    - cli创建的项目，内置了d.ts，同其他常规npm库一样，可在vscode、webstorm等支持d.ts的开发工具里正常开发并有语法提示。
    - 使用HBuilderX创建的项目不带d.ts，HBuilderX内置了uni-app语法提示库。如需把HBuilderX创建的项目在其他编辑器打开并且补充d.ts，可以在项目下先执行 npm init，然后npm i @types/uni-app -D，来补充d.ts。
    - 但vscode等其他开发工具，在vue或uni-app领域，开发效率比不过HBuilderX。详见：https://ask.dcloud.net.cn/article/35451
    - 发布App时，仍然需要使用HBuilderX。其他开发工具无法发布App，但可以发布H5、各种小程序。如需开发App，可以先在HBuilderX里运行起来，然后在其他编辑器里修改保存代码，代码修改后会自动同步到手机基座。
    - 如果使用cli创建项目，那下载HBuilderX时只需下载10M的标准版即可。因为编译器已经安装到项目下了。

## 2.使用图形化界面

```bash
vue ui
```

# 环境配置

## 1.webpack

越来越多的网站已经从网页模式进化到了 Webapp 模式。它们运行在现代的高级浏览器里，使用 HTML5、 CSS3、 ES6 等更新的技术来开发丰富的功能，网页已经不仅仅是完成浏览的基本需求，并且webapp通常是一个单页面应用，每一个视图通过异步的方式加载，这导致页面初始化和使用过程中会加载越来越多的 JavaScript 代码，这给前端开发的流程和资源组织带来了巨大的挑战。

如何在开发环境组织好这些碎片化的代码和资源，并且保证他们在浏览器端快速、优雅的加载和更新，就需要一个模块化系统

### 1.模块的演进

**用于在模块化中定义规范**

#### **script标签**

```js
<script src="module1.js"></script>
<script src="module2.js"></script>
```

这是最原始的 JavaScript 文件加载方式，如果把每一个文件看做是一个模块，那么他们的接口通常是暴露在全局作用域下，也就是定义在 `window` 对象中

#### **CommonJS**

是一种为JS的表现指定的规范，它希望js可以运行在任何地方，更多的说的是服务端模块规范，Node.js采用了这个规范。

核心思想
允许模块通过 `require` 方法来同步加载所要依赖的其他模块，然后通过 `exports` 或 `module.exports` 来导出需要暴露的接口。

**优点：**服务器端模块重用，NPM中模块包多，有将近20万个。

**缺点：**加载模块是同步的，只有加载完成后才能执行后面的操作，也就是当要用到该模块了，现加载现用，不仅加载速度慢，而且还会导致性能、可用性、调试和跨域访问等问题。Node.js主要用于服务器编程，加载的模块文件一般都存在本地硬盘，加载起来比较快，不用考虑异步加载的方式，因此,CommonJS规范比较适用。然而，这并不适合在浏览器环境，同步意味着阻塞加载，浏览器资源是异步加载的，因此有了AMD CMD解决方案。

**实现**：

- 服务器端的 [Node.js](http://www.nodejs.org/)
- [Browserify](http://browserify.org/)，浏览器端的 CommonJS 实现，可以使用 NPM 的模块，但是编译打包后的文件体积可能很大
- [modules-webmake](https://github.com/medikoo/modules-webmake)，类似Browserify，还不如 Browserify 灵活
- [wreq](https://github.com/substack/wreq)，Browserify 的前身

#### **AMD**

鉴于浏览器的特殊情况，又出现了一个规范，这个规范呢可以实现异步加载依赖模块，并且会提前加载那就是AMD规范。

**其核心接口是**：define(id, 『dependencies』, factory) ，它要在声明模块的时候指定所有的依赖 dependencies ，并且还要当做形参传到factory 中，对于依赖的模块提前执行，依赖前置。

```js
define("module", ["dep1", "dep2"], function(d1, d2) {
  return someExportedValue;
});
require(["module", "../file"], function(module, file) { /* ... */ });
```

**优点：**在浏览器环境中异步加载模块；并行加载多个模块；

**缺点：**开发成本高，代码的阅读和书写比较困难，模块定义方式的语义不顺畅；不符合通用的模块化思维方式，是一种妥协的实现；

#### **CMD**

Common Module Definition 规范和 AMD 很相似，尽量保持简单，并与 CommonJS 和 Node.js 的 Modules 规范保持了很大的兼容性。

```text
define(function(require, exports, module) {
  var $ = require('jquery');
  var Spinning = require('./spinning');
  exports.doSomething = ...
  module.exports = ...
})
```

**优点：**依赖就近，延迟执行（对于依赖的模块延迟执行） 可以很容易在 Node.js 中运行；
**缺点：**依赖 SPM 打包，模块的加载逻辑偏重；
**实现：Sea.js** ；coolie

#### **ES6**

ECMAScript6 标准增加了 JavaScript 语言层面的模块体系定义。[ES6 模块](http://es6.ruanyifeng.com/#docs/module)的设计思想，是尽量的静态化，使得编译时就能确定模块的依赖关系，以及输入和输出的变量。CommonJS 和 AMD 模块，都只能在运行时确定这些东西。

```js
import "jquery";
export function doStuff() {}
module "localModule" {}
```

优点：

- 容易进行静态分析
- 面向未来的 ECMAScript 标准

缺点：

- 原生浏览器端还没有实现该标准
- 全新的命令字，新版的 Node.js才支持

实现：

- [Babel](https://babeljs.io/)

### 2.前端模块加载原理

模块的加载和传输，我们首先能想到两种极端的方式，一种是每个模块文件都单独请求，另一种是把所有模块打包成一个文件然后只请求一次。显而易见，每个模块都发起单独的请求造成了请求次数过多，导致应用启动速度慢；一次请求加载所有模块导致流量浪费、初始化过程慢。这两种方式都不是好的解决方案

**分块传输**，按需进行懒加载，在实际用到某些模块的时候再增量更新，才是较为合理的模块加载方案。

```
所有资源都是模块
在上面的分析过程中，我们提到的模块仅仅是指JavaScript模块文件。然而，在前端开发过程中还涉及到样式、图片、字体、HTML 模板等等众多的资源。这些资源还会以各种方言的形式存在，比如 coffeescript、 less、 sass、众多的模板库、多语言系统（i18n）等等。

解决:
在编译的时候，要对整个代码进行静态分析，分析出各个模块的类型和它们依赖关系，然后将不同类型的模块提交给适配的加载器来处理。比如一个用 LESS 写的样式模块，可以先用 LESS 加载器将它转成一个CSS 模块，在通过 CSS 模块把他插入到页面的 <style> 标签中执行。
```

### 3.Webpack

Webpack 是一个模块打包器。它将根据模块的依赖关系进行静态分析，然后将这些模块按照指定的规则生成对应的静态资源。

![什么是webpack](https://zhaoda.net/webpack-handbook/images/what-is-webpack.png)



# uniapp手册

## 目录结构

一个uni-app工程，默认包含如下目录及文件：

```
┌─cloudfunctions        云函数目录（阿里云为aliyun，腾讯云为tcb，详见uniCloud）
│─components            符合vue组件规范的uni-app组件目录
│  └─comp-a.vue         可复用的a组件
├─hybrid                存放本地网页的目录，详见
├─platforms             存放各平台专用页面的目录，详见
├─pages                 业务页面文件存放的目录
│  ├─index
│  │  └─index.vue       index页面
│  └─list
│     └─list.vue        list页面
├─static                存放应用引用静态资源（如图片、视频等）的目录，注意：静态资源只能存放于此
├─wxcomponents          存放小程序组件的目录，详见
├─main.js               Vue初始化入口文件
├─App.vue               应用配置，用来配置App全局样式以及监听 应用生命周期
├─manifest.json         配置应用名称、appid、logo、版本等打包信息，详见
└─pages.json            配置页面路由、导航条、选项卡等页面类信息，详见
```

## **Tips**

### 1.资源路径说明

- 编译到任意平台时，`static` 目录下的文件均会被打包进去，非 `static` 目录下的文件（vue、js、css 等）被引用到才会被包含进去。

- `static` 目录下的 `js` 文件不会被编译，如果里面有 `es6` 的代码，不经过转换直接运行，在手机设备上会报错。

- `css`、`less/scss` 等资源同样不要放在 `static` 目录下，建议这些公用的资源放在 `common` 目录下。

- ```
  <!-- 绝对路径，/static指根目录下的static目录，在cli项目中/static指src目录下的static目录 -->
  <image class="logo" src="/static/logo.png"></image>
  <image class="logo" src="@/static/logo.png"></image>
  <!-- 相对路径 -->
  <image class="logo" src="../../static/logo.png"></image>
  
  // 绝对路径，@指向项目根目录，在cli项目中@指向src目录
  import add from '@/common/add.js'
  ```

- 本地背景图片/字体文件的引用路径推荐使用以 ~@ 开头的绝对路径。

  

### 2生命周期

- `uni-app` 支持如下应用生命周期函数：

  | 函数名               | 说明                                                         |
  | :------------------- | :----------------------------------------------------------- |
  | onLaunch             | 当`uni-app` 初始化完成时触发（全局只触发一次）               |
  | onShow               | 当 `uni-app` 启动，或从后台进入前台显示                      |
  | onHide               | 当 `uni-app` 从前台进入后台                                  |
  | onError              | 当 `uni-app` 报错时触发                                      |
  | onUniNViewMessage    | 对 `nvue` 页面发送的数据进行监听，可参考 [nvue 向 vue 通讯](https://uniapp.dcloud.io/use-weex?id=nvue-向-vue-通讯) |
  | onUnhandledRejection | 对未处理的 Promise 拒绝事件监听函数（2.8.1+）                |
  | onPageNotFound       | 页面不存在监听函数                                           |
  | onThemeChange        | 监听系统主题变化                                             |

  **注意**

  - 应用生命周期仅可在`App.vue`中监听，在其它页面监听无效。
  - onlaunch里进行页面跳转，如遇白屏报错，请参考https://ask.dcloud.net.cn/article/35942

- ### [页面生命周期](https://uniapp.dcloud.io/frame?id=页面生命周期)

### 3路由

- ## [路由](https://uniapp.dcloud.io/frame?id=路由)

  开发者需要在[pages.json](https://uniapp.dcloud.io/collocation/pages?id=pages)里配置每个路由页面的路径及页面样式。类似小程序在app.json中配置页面路由一样。所以 `uni-app` 的路由用法与 `Vue Router` 不同，如仍希望采用 `Vue Router` 方式管理路由，可在插件市场搜索 [Vue-Router](https://ext.dcloud.net.cn/search?q=vue-router)。

- ### [路由跳转](https://uniapp.dcloud.io/frame?id=路由跳转)

  `uni-app` 有两种页面路由跳转方式：使用[navigator](https://uniapp.dcloud.io/component/navigator)组件跳转、调用[API](https://uniapp.dcloud.io/api/router)跳转。

- ### [页面栈](https://uniapp.dcloud.io/frame?id=页面栈)

  框架以栈的形式管理当前所有页面， 当发生路由切换的时候，页面栈的表现如下：

  | 路由方式   | 页面栈表现                        | 触发时机                                                     |
  | ---------- | --------------------------------- | ------------------------------------------------------------ |
  | 初始化     | 新页面入栈                        | uni-app 打开的第一个页面                                     |
  | 打开新页面 | 新页面入栈                        | 调用 API  [uni.navigateTo](https://uniapp.dcloud.io/api/router?id=navigateto) 、使用组件  [](https://uniapp.dcloud.io/component/navigator?id=navigator) |
  | 页面重定向 | 当前页面出栈，新页面入栈          | 调用 API  [uni.redirectTo](https://uniapp.dcloud.io/api/router?id=redirectto) 、使用组件 [](https://uniapp.dcloud.io/component/navigator?id=navigator) |
  | 页面返回   | 页面不断出栈，直到目标返回页      | 调用 API  [uni.navigateBack](https://uniapp.dcloud.io/api/router?id=navigateback)  、使用组件 [](https://uniapp.dcloud.io/component/navigator?id=navigator) 、用户按左上角返回按钮、安卓用户点击物理back按键 |
  | Tab 切换   | 页面全部出栈，只留下新的 Tab 页面 | 调用 API  [uni.switchTab](https://uniapp.dcloud.io/api/router?id=switchtab) 、使用组件 [](https://uniapp.dcloud.io/component/navigator?id=navigator) 、用户切换 Tab |
  | 重加载     | 页面全部出栈，只留下新的页面      | 调用 API  [uni.reLaunch](https://uniapp.dcloud.io/api/router?id=relaunch) 、使用组件  [](https://uniapp.dcloud.io/component/navigator?id=navigator) |

### 4运行环境判断

[开发环境和生产环境](https://uniapp.dcloud.io/frame?id=开发环境和生产环境)

`uni-app` 可通过 `process.env.NODE_ENV` 判断当前环境是开发环境还是生产环境。一般用于连接测试服务器或生产服务器的动态切换。

- 在HBuilderX 中，点击“运行”编译出来的代码是开发环境，点击“发行”编译出来的代码是生产环境
- cli模式下，是通行的编译环境处理方式。

```javascript
if(process.env.NODE_ENV === 'development'){
    console.log('开发环境')
}else{
    console.log('生产环境')
}
```

**[判断平台](https://uniapp.dcloud.io/frame?id=判断平台)**

平台判断有2种场景，一种是在编译期判断，一种是在运行期判断。

- 编译期判断 编译期判断，即条件编译，不同平台在编译出包后已经是不同的代码。详见：[条件编译](https://uniapp.dcloud.io/platform)

```javascript
// #ifdef H5
    alert("只有h5平台才有alert方法")
// #endif
```
- 运行期判断 运行期判断是指代码已经打入包中，仍然需要在运行期判断平台，此时可使用 `uni.getSystemInfoSync().platform` 判断客户端环境是 Android、iOS 还是小程序开发工具（在百度小程序开发工具、微信小程序开发工具、支付宝小程序开发工具中使用 `uni.getSystemInfoSync().platform` 返回值均为 devtools）。

### 5页面样式与尺寸

[尺寸单位](https://uniapp.dcloud.io/frame?id=尺寸单位)

`uni-app` 支持的通用 css 单位包括 px、rpx

- px 即屏幕像素

- rpx 即响应式px，一种根据屏幕宽度自适应的动态单位。

  rpx 是相对于基准宽度的单位，可以根据屏幕宽度进行自适应。

  ```
  开发者可以通过设计稿基准宽度计算页面元素 rpx 值，设计稿 1px 与框架样式 1rpx 转换公式如下：
  设计稿 1px / 设计稿基准宽度 = 框架样式 1rpx / 750rpx
  750 * 元素在设计稿中的宽度 / 设计稿基准宽度
  
  举例说明：
  若设计稿宽度为 750px，元素 A 在设计稿上的宽度为 100px，那么元素 A 在 uni-app 里面的宽度应该设为：750 * 100 / 750，结果为：100rpx。
  若设计稿宽度为 640px，元素 A 在设计稿上的宽度为 100px，那么元素 A 在 uni-app 里面的宽度应该设为：750 * 100 / 640，结果为：117rpx。
  ```

- ### 固定值

`uni-app` 中以下组件的高度是固定的，不可修改：

| 组件          | 描述       | App                                                          | H5   |
| :------------ | :--------- | :----------------------------------------------------------- | :--- |
| NavigationBar | 导航栏     | 44px                                                         | 44px |
| TabBar        | 底部选项卡 | HBuilderX 2.3.4之前为56px，2.3.4起和H5调为一致，统一为 50px。但可以自主更改高度） |      |

### 6WXS

WXS是一套运行在视图层的脚本语言

它的特点是运行在视图层。当需要避免逻辑层和渲染层交互通信折损时，可采用wxs。

### 7renderjs

`renderjs`是一个运行在视图层的js。它比[WXS](https://uniapp.dcloud.io/?id=wxs)更加强大。它只支持app-vue和h5。

`renderjs`的主要作用有2个：

- 大幅降低逻辑层和视图层的通讯损耗，提供高性能视图交互能力
- 在视图层操作dom，运行for web的js库

**使用方式**

设置 script 节点的 lang 为 renderjs

```html
<script module="test" lang="renderjs">
    export default {
        mounted() {
            // ...
        },
        methods: {
            // ...
        }
    }
</script>
```

## 使用vue注意事项

### uniapp中nvue与vue的区别

uni-app是逻辑和渲染分离的，渲染层在**app端**提供了两套排版引擎。
小程序方式的webview渲染，和weex方式的原生渲染，两种渲染引擎可以自己根据需要选。
 **vue文件走的webview渲染**
 **nvue走weex方式的原生渲染**

组件和js写法是一样的，css不一样，原生排版的能用的css必须是flex布局

虽然nvue也可以多端编译，输出H5和小程序，但nvue的css写法受限，所以如果你不开发App，那么不需要使用nvue。

一个**App**中可以同时使用两种页面，比如首页使用nvue，二级页使用vue页面，hello uni-app示例就是如此。

### nvue适用场景

在App端某些vue页面表现不佳的场景下使用 nvue 作为强化补充。这些场景如下：

1. 需要高性能的区域长列表或瀑布流滚动。webview的页面级长列表滚动时没有性能问题的（就是滚动条覆盖webview整体高度），但页面中某个区域做长列表滚动，则需要使用nvue的`list`、`recycle-list`、`waterfall`等组件([详见](https://uniapp.dcloud.io/component/list))。这些组件的性能要高于vue页面里的区域滚动组件`scroll-view`。
2. 复杂高性能的自定义下拉刷新。uni-app的pages.json里可以配置原生下拉刷新，但引擎内置的下拉刷新样式只有雪花和circle圈2种样式。如果你需要自己做复杂的下拉刷新，推荐使用nvue的refresh组件。当然[插件市场](https://ext.dcloud.net.cn/search?q=下拉刷新)里也有很多vue下的自定义下拉刷新插件，只要是基于renderjs或wxs的，性能也可以商用，只是没有nvue的`refresh`组件更极致。
3. 左右拖动的长列表。在webview里，通过`swiper`+`scroll-view`实现左右拖动的长列表，前端模拟下拉刷新，这套方案的性能不好。此时推荐使用nvue，比如新建uni-app项目时的[新闻示例模板](https://ext.dcloud.net.cn/plugin?id=103)，就采用了nvue，切换很流畅。
4. 实现区域滚动长列表+左右拖动列表+吸顶的复杂排版效果，效果可参考hello uni-app模板里的`swiper-list`。[详见](https://ext.dcloud.net.cn/plugin?id=2128)
5. 如需要将软键盘右下角按钮文字改为“发送”，则需要使用nvue。比如聊天场景，除了软键盘右下角的按钮文字处理外，还涉及聊天记录区域长列表滚动，适合nvue来做。
6. 解决前端控件无法覆盖原生控件的层级问题。当你使用`map`、`video`、`live-pusher`等原生组件时，会发现前端写的`view`等组件无法覆盖原生组件，层级问题处理比较麻烦，此时使用nvue更好。或者在vue页面上也可以覆盖一个subnvue（一种非全屏的nvue页面覆盖在webview上），以解决App上的原生控件层级问题。[详见](https://uniapp.dcloud.io/component/native-component)
7. 如深度使用`map`组件，建议使用nvue。除了层级问题，App端nvue文件的map功能更完善，和小程序拉齐度更高，多端一致性更好。
8. 如深度使用`video`，建议使用nvue。比如如下2个场景：video内嵌到swiper中，以实现抖音式视频滑动切换，例子见[插件市场](https://ext.dcloud.net.cn/search?q=仿抖音)；nvue的视频全屏后，通过`cover-view`实现内容覆盖，比如增加文字标题、分享按钮。
9. 直播推流：nvue下有`live-pusher`组件，和小程序对齐，功能更完善，也没有层级问题。
10. 对App启动速度要求极致化。App端v3编译器模式下，如果首页使用nvue且在manifest里配置fast模式，那么App的启动速度可以控制在1秒左右。而使用vue页面的话，App的启动速度一般是3秒起，取决于你的代码性能和体积。



### [nvue开发与vue开发的常见区别](https://uniapp.dcloud.io/use-weex?id=nvue开发与vue开发的常见区别)

基于原生引擎的渲染，虽然还是前端技术栈，但和web开发肯定是有区别的。

1. nvue 页面控制显隐只可以使用`v-if`不可以使用`v-show`
2. nvue 页面只能使用`flex`布局，不支持其他布局方式。页面开发前，首先想清楚这个页面的纵向内容有什么，哪些是要滚动的，然后每个纵向内容的横轴排布有什么，按 flex 布局设计好界面。
3. nvue 页面的布局排列方向默认为竖排（`column`），如需改变布局方向，可以在 `manifest.json` -> `app-plus` -> `nvue` -> `flex-direction` 节点下修改，仅在 uni-app 模式下生效。[详情](https://uniapp.dcloud.io/collocation/manifest?id=nvue)。
4. nvue页面编译为H5、小程序时，会做一件css默认值对齐的工作。因为weex渲染引擎只支持flex，并且默认flex方向是垂直。而H5和小程序端，使用web渲染，默认不是flex，并且设置`display:flex`后，它的flex方向默认是水平而不是垂直的。所以nvue编译为H5、小程序时，会自动把页面默认布局设为flex、方向为垂直。当然开发者手动设置后会覆盖默认设置。
5. 文字内容，必须、只能在`<text>`组件下。不能在`<div>`、`<view>`的`text`区域里直接写文字。否则即使渲染了，也无法绑定js里的变量。
6. 只有`text`标签可以设置字体大小，字体颜色。
7. 布局不能使用百分比、没有媒体查询。
8. nvue 切换横竖屏时可能导致样式出现问题，建议有 nvue 的页面锁定手机方向。
9. 支持的css有限，不过并不影响布局出你需要的界面，`flex`还是非常强大的。详见
10. 不支持背景图。但可以使用`image`组件和层级来实现类似web中的背景效果。因为原生开发本身也没有web这种背景图概念
11. css选择器支持的比较少，只能使用 class 选择器。[详见](https://uniapp.dcloud.io/use-weex?id=样式)
12. nvue 的各组件在安卓端默认是透明的，如果不设置`background-color`，可能会导致出现重影的问题。
13. `class` 进行绑定时只支持数组语法。
14. Android端在一个页面内使用大量圆角边框会造成性能问题，尤其是多个角的样式还不一样的话更耗费性能。应避免这类使用。
15. nvue页面没有`bounce`回弹效果，只有几个列表组件有`bounce`效果，包括 `list`、`recycle-list`、`waterfall`。
16. 原生开发没有页面滚动的概念，页面内容高过屏幕高度并不会自动滚动，只有部分组件可滚动（`list`、`waterfall`、`scroll-view/scroller`），要滚得内容需要套在可滚动组件下。这不符合前端开发的习惯，所以在 nvue 编译为 uni-app模式时，给页面外层自动套了一个 `scroller`，页面内容过高会自动滚动。（组件不会套，页面有`recycle-list`时也不会套）。后续会提供配置，可以设置不自动套。
17. 在 App.vue 中定义的全局js变量不会在 nvue 页面生效。`globalData`和`vuex`是生效的。
18. App.vue 中定义的全局css，对nvue和vue页面同时生效。如果全局css中有些css在nvue下不支持，编译时控制台会报警，建议把这些不支持的css包裹在[条件编译](https://uniapp.dcloud.io/platform)里，`APP-PLUS-NVUE`
19. 不能在 `style` 中引入字体文件，nvue 中字体图标的使用参考：[加载自定义字体](https://uniapp.dcloud.io/use-weex?id=addrule)。如果是本地字体，可以用`plus.io`的API转换路径。
20. 目前不支持在 nvue 页面使用 `typescript/ts`。
21. nvue 页面关闭原生导航栏时，想要模拟状态栏，可以[参考文章](https://ask.dcloud.net.cn/article/35111)。但是，仍然强烈建议在nvue页面使用原生导航栏。nvue的渲染速度再快，也没有原生导航栏快。原生排版引擎解析`json`绘制原生导航栏耗时很少，而解析nvue的js绘制整个页面的耗时要大的多，尤其在新页面进入动画期间，对于复杂页面，没有原生导航栏会在动画期间产生整个屏幕的白屏或闪屏。

### Tips

- `uni-app` 完整支持 `Vue` 实例的生命周期，同时还新增 [应用生命周期](https://uniapp.dcloud.io/frame?id=应用生命周期) 及 [页面生命周期](https://uniapp.dcloud.io/frame?id=页面生命周期)。

- `uni-app` 完整支持 `Vue` 模板语法

- `data` 必须声明为返回一个初始数据对象的函数（注意函数内返回的数据对象不要直接引用函数外的对象）；否则页面关闭时，数据不会自动销毁，再次打开该页面时，会显示上次数据。

  ```
  data() {
      return {
          title: 'Hello'
      }
  }
  ```

## 条件编译

条件编译是用特殊的注释作为标记，在编译时根据这些特殊的注释，将注释里面的代码编译到不同平台。

**写法：**以 #ifdef 或 #ifndef 加 **%PLATFORM%** 开头，以 #endif 结尾。

- \#ifdef：if defined 仅在某平台存在
- \#ifndef：if not defined 除了某平台均存在
- **%PLATFORM%**：平台名称

| #ifdef **APP-PLUS** 需条件编译的代码 #endif              | 仅出现在 App 平台下的代码                                    |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| #ifndef **H5** 需条件编译的代码 #endif                   | 除了 H5 平台，其它平台均存在的代码                           |
| #ifdef **H5** \|\| **MP-WEIXIN** 需条件编译的代码 #endif | 在 H5 平台或微信小程序平台存在的代码（这里只有\|\|，不可能出现&&，因为没有交集） |

**%PLATFORM%** **可取值如下：**

| 值            | 平台           |
| :------------ | :------------- |
| APP-PLUS      | App            |
| APP-PLUS-NVUE | App nvue       |
| H5            | H5             |
| MP-WEIXIN     | 微信小程序     |
| MP-ALIPAY     | 支付宝小程序   |
| MP-BAIDU      | 百度小程序     |
| MP-TOUTIAO    | 字节跳动小程序 |

### pages.json 的条件编译

下面的页面，只有运行至 App 时才会编译进去。

![img](https://img-cdn-qiniu.dcloud.net.cn/uniapp/doc/img/platform-4.png)



# API

getApp() 函数用于获取当前应用实例，一般用于获取globalData 。

# mysql

mysql -uroot -h 127.0.0.1 -p

use ebook;

show tables;

mysql> create table login(
    -> username char(9),
    -> password char(12)
    -> )charset utf8;

show tables;

desc login;

insert into login values('liming','123456');

 select * from login where username = 'liming';