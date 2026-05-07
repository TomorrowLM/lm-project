<template>
  <div :style="{ 'padding-top': StatusBarHeight + 'px' }">
    <view v-if="tabIndex == '小说'">
      <view class="main">
        <view class="book_detail_box">
          <image :src="book_info.cover" lazy-load></image>
          <view class="book_detail">
            <text class="book_title">{{ book_info.name }}</text>
            <view class="book_author_title"
              >作者：<navigator
                :url="'/pages/searchRes/searchRes?keyword=' + book_info.author"
                class="book_author"
                >{{ book_info.author }}</navigator
              ></view
            >
            <text class="book_cate"
              >类别：{{ book_info.fictionType }}　{{ book_info.stype }}</text
            >
            <view class="rating_title"
              >喜欢人数：
              <text class="rating_score" v-if="book_info.remark">{{
                book_info.fav_num
              }}</text>
              <text v-else>没人喜欢T^T</text>
            </view>
          </view>
        </view>
        <scroll-view class="other" scroll-y>
          <view class="other_box">
            <view class="other_title">简　介</view>
            <view class="other_content">{{ book_info.descs }}</view>
            <!-- <view class="other_content"></view> -->
          </view>
          <view class="other_box">
            <view class="other_title">最新章节</view>
            <view class="other_content">
              <view
                v-for="(item,index) in newestChapter"
                :key="index"
                class="book_source"
                >
					<text style="color: black">{{ item.title }}</text>
			  </view>
            </view>
          </view>
          <view class="other_box">
            <view class="other_title"
              >作者书籍<text style="color: #cccccc; font-size: 24rpx"></text
            ></view>
            <scroll-view scroll-x>
              <view v-if="author_books.length > 0">
                <navigator
                  v-for="(item, index) in author_books"
                  :key="index"
                  :url="'/pages/bookinfo/bookinfo?book=' + item.book_id"
                  class="related_book"
                >
                  <image :src="item.image"></image>
                  <view class="related_book_title">{{ item.name }}</view>
                </navigator>
              </view>
              <view v-else class="result_tips">暂无其他书籍</view>
            </scroll-view>
          </view>
          <view class="other_box">
            <view class="other_title">热门评论</view>
            <view v-if="book_reviews.length > 0">
              <view
                v-for="(item, index) in book_reviews"
                :key="index"
                class="other_content"
                style="border-bottom: 1px solid #dddddd; display: flex"
              >
                <view style="flex: 1">
                  <view><image :src="item.avatar" class="avatar"></image></view>
                  <!-- <view class="reviews_title">{{item.nick}}</view> -->
                </view>
                <view class="reviews_content">{{ item.content }}</view>
              </view>
            </view>
            <view v-else class="result_tips">暂无评论</view>
          </view>
        </scroll-view>

        <view class="footer">
<!--          <picker
            class="button"
            :value="index"
            range-key="site_name"
            :range="book_source_info"
          >
            <view class="select_source">{{
              index < 0 ? "选择书源" : book_source_info[index].site_name
            }}</view>
          </picker> -->
		  <view class="button start_read" @click="collect">加入收藏</view>
          <view
            :class="'button ' + add_to_mybooks_style"
            @click="addToMybooks()"
            >{{ add_book_stat }}</view
          >
          <view class="button start_read" @click="read">开始阅读</view>
        </view>
      </view>
    </view>
  </div>
</template>

<script>
import uniSearchBar from "@/components/uni-search-bar/uni-search-bar.vue";
import vTab from "@/components/v-tabs/v-tabs.vue";
// import Person from "../../global";
export default {
  data() {
    return {
      book_author: "",
      book_info: {},
      book_source_info: [],
      // 书源
      author_books: [],
      // 作者其他书籍
      book_reviews: {},
      // 评论
      // select_source_tips: "选择书源",
      index: -1,
      source_id: "",
      mybooks: [],
      add_book_stat: "加入书架",
      add_to_mybooks_style: "add_to_mybooks",
      add_fun: "addToMybooks()",
      get_data_flag: 0,
      token: "",
      userId: "",
      StatusBarHeight: 0,
      current: 0,
      tabIndex: "小说",
	  newestChapter: []
    };
  },
  beforeCreate() {
	
  },
  onLoad(option) {
    const that = this;
    option.book = JSON.parse(option.book);
   // console.log(option.book); //打印出上个页面传递的参数。
    this.book_info = option.book;
    uni.getSystemInfo({
      success(res) {
        that.StatusBarHeight = res.statusBarHeight;
      },
    });
	uni.request({
		url:'http://api.pingcc.cn/fictionChapter/search/'+this.book_info.fictionId,
		success: (res)=>{	
			this.newestChapter = res.data.data.data.splice(-5)
		}
	})
  },
  activated() {
    document.getElementsByTagName("uni-page-wrapper")[0].style.background =
      "white";
  },
  methods: { 


	read(fictionId) {
	  uni.navigateTo({
	    url: "/pages/read/index?fictionId=" + this.book_info.fictionId,
	  });
	},
	collect(){
		console.log(this.book_info)
		this.$store.commit('collect',this.book_info)
  },
  addToMybooks(){
  	this.$store.commit('bookshelfActive',this.book_info)
	console.log(this.$store.state.localbookshelf)
  },
  },
  components: { uniSearchBar, vTab },
};
</script>

<style>
 @import url("./bookdetail.css");
</style>
