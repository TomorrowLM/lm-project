<template>
  <div class="book" ref="book">
	  <div  :style="{'height':StatusBarHeight +'px',backgroundColor:'transparent'}"></div>
    <uni-nav-bar
      left-icon="bars"
      left-text=""
      title="书架"
      fixed="true"
      color="$uni-color-success"
      @clickLeft="showDrawer('showLeft')"
      style="margin-bottom:10px;border:2px solid #1f1f4d66"
    >
    </uni-nav-bar>
    <uni-drawer
      ref="showLeft"
      mode="left"
      :width="180"
      @change="change($event, 'showLeft')"
    >
      <view class="imgInch" @click="goToMine">
        <cmd-cel-item slot-right>
          <cmd-avatar
            src="https://avatar.bbs.miui.com/images/noavatar_small.gif"
          ></cmd-avatar>
        </cmd-cel-item>
      </view>
      <button @click="goToSelectFile" class="goToMine">本地文件</button>
    </uni-drawer>
	<view class="content">
	<view class="book-list"  v-for="(book, index) in this.$store.state.localbookshelf" :key="index">
			  <view class="book"  :id="book[1]" @longtap="longtap" @click="readlocal(book[1])">
			    <image src="../../static/book-tree.jpg" style="max-height: 100%;">
			    <text class="text-center">{{ book[0] }}</text> 
			  </view> 
	</view>
	</view>
    <view class="content">
      <view class="book-list" v-for="(book, index) in this.$store.state.bookshelf" :key="index">
        <view class="book" :id="book.fictionId" @longtap="longtap" @click="read(book.fictionId)">
          <image :src="book.cover">
          <text class="text-center">{{ book.title }}</text> 
        </view>
      </view>
    </view>
	<tan-chu :deleteEle="deleteEle"></tan-chu>
  </div>
</template>
 
<script>
import uniNavBar from "@/components/uni-nav-bar/uni-nav-bar.vue";
import uniSearchBar from "@/components/uni-search-bar/uni-search-bar.vue";
import uniDrawer from "@/components/uni-drawer/uni-drawer.vue";
import cmdAvatar from "@/components/cmd-person_1.1/components/cmd-avatar/cmd-avatar.vue";
import cmdCelItem from "@/components/cmd-person_1.1/components/cmd-cell-item/cmd-cell-item.vue";
import tanChu from "@/components/a-tanchu/tanchu.vue";
export default {
  components: {
    uniNavBar,
    uniSearchBar,
    uniDrawer,
    cmdAvatar,
    cmdCelItem,
    tanChu,
  },
  data() {
    return {
      StatusBarHeight: 0,
      title: "Hello",
      bookList: this.$store.state.bookshelf,
      resInfo: "",
      deleteEle: {},
    };
  },
  watch: {
    bookList: function (newValue, old) {},
  },
  onLoad() {
    const that = this;
    uni.getSystemInfo({
      success(res) {
        that.StatusBarHeight = res.statusBarHeight;
      },
    });
  },
  watch:{
    bookList:function(newValue,old){
 
    }
  },
  onLoad() {
    console.log(this.$store.state.bookshelf)
  	const that = this;
  		uni.getSystemInfo({
  			success(res) {
  				that.StatusBarHeight = res.statusBarHeight;
  			}
  		}) 
  },
  methods: {
    longtap(e) {
      this.$store.state.isDeleteInbook = true;
      this.deleteEle = e;
    },
    //   handletouchstart(e) {
    //     this.timeOutEvent = setTimeout(() => {
    //       this.onLongPress(e);
    //     }, 1000); //这里设置定时器，定义长按1000毫秒触发长按事件，时间可以自己改，
    //     return false;
    //   },
    //   handletouchend(fictionId) {
    //     clearTimeout(this.time); //清除定时器
    //     if (this.time != 0) {
    //       //处理点击时间
    // uni.navigateTo({
    //   url: "/pages/read/index?fictionId=" + fictionId,
    // });
    //     }
    //     return false;
    //   },
    //   handletouchmove() {
    //     clearTimeout(this.time); //清除定时器
    //     this.time = 0;
    //   },
    //   onLongPress(e) {
    //     // 处理长按事件
    //     this.$store.state.isDeleteInbook = true;
    //     this.deleteEle = e;
    //   },
    showDrawer(e) {
      this.$refs[e].open();
    },
    // 关闭窗口
    closeDrawer(e) {
      this.$refs[e].close();
    },
    // 抽屉状态发生变化触发
    change(e, type) {
      // console.log(Page.path);
      // console.log(
      //   (type === "showLeft" ? "左窗口" : "右窗口") + (e ? "打开" : "关闭")
      // );
      this[type] = e;
    },
    goToMine() {},
    async goToSelectFile() {
      var that = this;
      var REQUESTCODE = 1;
      var main = plus.android.runtimeMainActivity();
      var Intent = plus.android.importClass("android.content.Intent");
      var intent = new Intent(Intent.ACTION_GET_CONTENT);
      intent.setType("*/*"); //设置类型，任意类型
      //intent.setType("image/*");
      //intent.setType("audio/*"); //选择音频
      //intent.setType("video/*"); //选择视频 （mp4 3gp 是android支持的视频格式）
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      main.startActivityForResult(intent, REQUESTCODE);
      main.onActivityResult = await function (requestCode, resultCode, data) {
        if (REQUESTCODE == requestCode) {
          var context = main;
          plus.android.importClass(data);
          // 获得文件路径
          var fileData = data.getData();
          var path = plus.android.invoke(fileData, "getPath");
          console.log("path:" + path);
          var bookname = path.split("/");
          bookname = bookname[bookname.length - 1];
          console.log(bookname);
          that.$store.commit("bookSelectNameActive", [bookname, path]);
          // 判断文件类型
          var resolver = context.getContentResolver();
          var fileType = plus.android.invoke(resolver, "getType", fileData);
           console.log("fileType:" + fileType);
          that.$store.state.isShowInbook = true;
        }
      };
    },
	readlocal(path){
		uni.navigateTo({
		  url: "/pages/read/local?path=" + path,
		});
	},
    read(fictionId) {
      uni.navigateTo({
        url: "/pages/read/index?fictionId=" + fictionId,
      });
    },
  },
};
</script>

<style scoped>
@import url("book.css");
</style>
