<template>
  <div class="book" ref="book">
	   <div  :style="{'height':StatusBarHeight +'px',backgroundColor:'transparent'}"></div>
	  <uni-nav-bar
	    left-text=""
	    title="我的收藏"
	    fixed="true"
	    color="$uni-color-success"
	    @clickLeft="showDrawer('showLeft')"
	    style="margin-bottom:10px;border:2px solid #1f1f4d66"
	  >
	  </uni-nav-bar>
    <view class="content">
      <view class="book-list" v-for="(book, index) in this.$store.state.collectBook" :key="index">
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
      bookList: this.$store.state.collectBook,
      resInfo: "",
      deleteEle: {},
	  book_info:{},
    };
  },
  watch: {
    bookList: function (newValue, old) {},
  },
  onLoad(e) {
    const that = this;
    uni.getSystemInfo({
      success(res) {
        that.StatusBarHeight = res.statusBarHeight;
      },
    });
  },
  methods: {
    longtap(e) {
      this.$store.state.isCollectbook = true;
      this.deleteEle = e;
    },
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
          // console.log("fileType:" + fileType);
          that.$store.state.isShowInbook = true;
        }
      };
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
@import url("collect.css");
</style>
