<template>

      <div :style="{'padding-top':StatusBarHeight +'px'}">
    <uni-search-bar @search="searchBook"></uni-search-bar>
	<input type="text">
    <view class="content">
      <!-- <v-tabs v-model="current" :tabs="tabs" @change="changeTab"></v-tabs> -->
	  <!-- <v-tabs v-model="current" :scroll="false" :tabs="tabs" @change="changeTab"></v-tabs> -->
      <view class="book-list" v-for="(book, index) in searchBooklist" :key="index">
        <view class="book" @click="toBookdetail(book)">
          <image :src='book.cover'>
          <text class="text-center">{{ book.title }}</text>
        </view>
      </view>
    </view>
  </div>

</template>

<script>
import uniSearchBar from "@/components/uni-search-bar/uni-search-bar.vue";
import vTab from "@/components/v-tabs/v-tabs.vue";
export default {
  data() {
    return {
      bookName: "",
      showBook: false,
      searchBooklist: [],
      StatusBarHeight: 0,
      //    tabs: [
      //      "小说",
      //      "文学",
      //      "新闻"
      // ],
      // current: 0,
      // tabIndex:'小说',
    };
  },
  onLoad() {
    const that = this;
    uni.getSystemInfo({
      success(res) {
        that.StatusBarHeight = res.statusBarHeight;
      },
    });
  },

  activated() {
    document.getElementsByTagName("uni-page-wrapper")[0].style.background =
      "white";
  },
  methods: {
    changeTab(index) {
      this.tabIndex = this.tabs[index];
    },
    searchBook(value) {
      this.bookName = value;
      uni.request({
        url: "http://api.pingcc.cn/fiction/search/title/" + this.bookName, //仅为示例，并非真实接口地址。
        success: (res) => {
          let a = res.data.data.data;
          this.searchBooklist = a;
        },
      });
    },
    toBookdetail(book) {
      uni.navigateTo({
        // "'/pages/test/test?item='+ encodeURIComponent(JSON.stringify(item))"
        url:
          "/pages/search/bookdetail?id=1&book=" +
          encodeURIComponent(JSON.stringify(book)),
      });
    },
  },
  components: { uniSearchBar, vTab },
};
</script>

<style>
@import url("index.css");
</style>
