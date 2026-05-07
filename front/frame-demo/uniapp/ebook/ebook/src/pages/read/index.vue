<template>
  <view class="page-head">
    <view class="page">
      <view class="fictionwrap" v-if="ReadContent">
        <scroll-view
          scroll-y="true"
          class="fictionwrap"
          lower-threshold="50"
          @scrolltolower="lower"
        >
          <view
            class="fcontent"
            :style="{ fontSize: `${fontSize}rem` }"
            :class="skinValue"
            v-html="ReadContent"
          ></view>
        </scroll-view>
      </view>
      <uni-loading status="loading" v-else></uni-loading>
      <!-- 屏幕居中点击层 -->
      <view class="clickview" @tap="showopview"> </view>

      <!-- 底部弹出层 打开目录和设置 -->
      <uni-popup ref="opbottom" type="bottom">
        <view class="op-footer">
          <view class="foot-wrap" @tap="openclist">
            <fa-icon type="bars" size="22" color="#F7F7F7"></fa-icon>
            <view class="foot-text">目录</view>
          </view>
          <view class="foot-wrap" @tap="opensetting">
            <fa-icon type="cog" size="22" color="#F7F7F7"></fa-icon>
            <view class="foot-text">设置</view>
          </view>
        </view>
      </uni-popup>
      <!-- 目录层 -->
      <uni-drawer ref="clistdrawer" mode="left">
        <view class="chapterwrap">
          <view class="zjmu">章节目录</view>
          <view class="totalnum"> 共{{ clist.length }}章</view>
          <view class="zhengwj">正文卷</view>
          <scroll-view
            scroll-y="true"
            :style="{ height: windowHeight }"
            :scroll-into-view="viewId"
          >
            <view
              class="clistwrap"
              v-for="(item, index) in clist"
              :key="index"
              @tap="details(item.chapterId)"
            >
              <view
                :id="'cid' + item.corder"
                class="listitem"
                :class="index + 1 == corder ? 'text-orange' : ''"
                >{{ item.title }}</view
              >
            </view>
          </scroll-view>
        </view>
      </uni-drawer>
      <!-- 字体大小和颜色层 -->
      <uni-popup ref="fontandcolor" type="bottom">
        <view class="fcwrap">
          <view class="fontwrap">
            <slider
              :value="fontSizeSlider"
              activeColor="#f37b1d"
              backgroundColor="#464646"
              block-color="#f37b1d"
              block-size="22"
              min="1"
              max="8"
              @change="fontSizeChange"
              @changing="fontSizeChange"
            />
          </view>
          <view class="colorwrap">
            <view class="coloritem" v-for="(s, index) in skinData" :key="index">
              <button class="chcekbutton" :class="s.key" v-if="s.checked">
                <fa-icon type="check" color="#f37b1d" size="22"></fa-icon>
              </button>
              <button
                class="chcekbutton"
                @tap="skinCheckbox(index, s.key)"
                :class="s.key"
                v-else
              ></button>
            </view>
          </view>
        </view>
      </uni-popup>
    </view>
  </view>
</template>

<script>
//抽屉 与 弹出层
import uniDrawer from "@/components/uni-drawer/uni-drawer.vue";
import uniPopup from "@/components/uni-popup/uni-popup.vue";
export default {
  components: {
    uniDrawer,
    uniPopup,
  },
  data() {
    return {
      corder: 0,
      fictionid: "",
      cachekey: "",
      viewId: "",
      clickid: undefined,
      clist: [],
      windowHeight: 0,
      fontSize: 1,
      fontSizeSlider: 2,
      skinData: [
        { key: "default", checked: true },
        { key: "blue", checked: false },
        { key: "green", checked: false },
        { key: "light", checked: false },
        { key: "night", checked: false },
      ],
      skinValue: "default",
      layoutData: [],
      loadnext: false,
      ReadContent: "",
      addBtn: false,
      bookReadAddress: "",
      title: "",
    };
  },
  onLoad(e) {
    //章节目录的高度动态获取
    var me = this;
    uni.getSystemInfo({
      success(res) {
        me.windowHeight = res.windowHeight - 126 + "px";
      },
    });
    let chapter_url = "http://api.pingcc.cn/fictionChapter/search/";
    let indexurl = "http://api.pingcc.cn/fictionContent/search/";
    me.fictionid = e.fictionId;
    me.indexurl = indexurl;
    me.chapter_url = chapter_url;
    //获取现在是第几个元素正在被显示
    me.corder = e.corder;
    me.viewId = "cid" + me.corder;

    var bookReadAddress;
    this.$store.state.bookReadAddress.forEach((value, index) => {
      if (value.fictionId == me.fictionid) {
        this.bookReadAddress = value.bookReadAddress;
      }
    });

    this.getChapterContent(this.bookReadAddress);
    this.getBookChapter(indexurl);

    //uni.removeStorageSync("cachebookchapter");
  },

  methods: {
    lower: function (e) {
      var me = this;
      new Promise((resolve) => {
        var url1 = me.chapter_url + me.fictionid;
        uni.request({
          url: url1, //仅为示例，并非真实接口地址。
          success: (res) => {
            let chapter = res.data.data.data;
            let a = new Array();
            me.clist = chapter;
            console.log(this.bookReadAddress);
            me.clist.forEach((value, index) => {
              if (this.bookReadAddress == value.chapterId) {
                this.title = me.clist[index + 1].title;
                resolve();
              }
            });
          },
        });
      }).then((title) => {
        me.bookReadAddress = String(Number(me.bookReadAddress) + 1);
        var url = me.indexurl + me.bookReadAddress;
        // console.log(url)
        uni.request({
          url: url, //仅为示例，并非真实接口地址。
          success: (res) => {
            console.log(this.title);
            let ctitlehtml =
              "<h5 style='text-align:center'>" + this.title + "</h5>";
            me.ReadContent =
              me.ReadContent + ctitlehtml + res.data.data.data.content.join("");
            this.$store.commit("bookReadAddress1", [
              this.fictionid,
              this.bookReadAddress,
            ]);
          },
        });
      });
    },
    //缓存当前读书的章节  点目录的不管只缓存下滑的
    cachebookcp(corder) {
      var me = this;
      var cachemap = uni.getStorageSync("cachebookchapter");
      if (cachemap == "" || cachemap == null || cachemap == undefined) {
        cachemap = [];
        let cachebook = { key: me.fictionid, value: corder };
        cachemap.push(cachebook);
      }
      if (cachemap.length > 0) {
        let exist = false;
        for (let i = 0; i < cachemap.length; i++) {
          //console.log(cachemap[i].key == me.indexurl);
          if (cachemap[i].key == me.fictionid) {
            cachemap[i].value = corder;
            exist = true;
            break;
          }
        }
        if (!exist) {
          let cachebook = { key: me.fictionid, value: corder };
          cachemap.push(cachebook);
        }
      }
      console.log(cachemap);
      uni.setStorageSync("cachebookchapter", cachemap);
      //console.log(uni.getStorageSync("cachebookchapter"));
    },
    getChapterContent(chapter_url) {
      var me = this;
      var url = me.indexurl + chapter_url;
      uni.request({
        url: url, //仅为示例，并非真实接口地址。
        success: (res) => {
          me.ReadContent = res.data.data.data.content.join("");
        },
      });
    },

    getBookChapter(indexurl) {
      var me = this;
      var url = me.chapter_url + me.fictionid;
      uni.request({
        url: url, //仅为示例，并非真实接口地址。
        success: (res) => {
          let chapter = res.data.data.data;
          let a = new Array();
          me.clist = chapter;
        },
      });
    },
    //点击目录显示书籍详情
    details(item) {
      var me = this;
      //me.changeurl();

      //同个列表多次点击只算一次点击
      if (!me.clickid) {
        me.clickid = item.id;
      } else if (me.clickid == item.id) {
        return;
      }
      me.clickid = item.id;
      me.corder = item.corder;

      let ctitle = item.chapterTitle;
      uni.setNavigationBarTitle({
        title: ctitle,
      });

      me.ReadContent = ""; //清空重新加载
      //如果已经有滚动，需要清空滚动
      uni.pageScrollTo({
        scrollTop: 0,
      });
      this.$store.commit("bookReadAddress1", [me.fictionid, item]);
      me.getChapterContent(item);
      //this.getNewReadContent();
    },
    //动态改变url
    changeurl() {
      var me = this;
      var url = window.location.href;
      var valiable = url.split("?")[0];

      var param =
        "?chapter_id=" + me.cinfo.id + "&fictionid=" + me.cinfo.fictionId;
      window.history.pushState({}, 0, valiable + param);
    },
    getNewReadContent() {
      var me = this;
      let corder = me.cinfo.corder;
      ///取数组的下一个元素赋值给当前的cinfo
      me.cinfo = me.clist[corder];

      uni.setNavigationBarTitle({
        title: me.cinfo.chapterTitle,
      });
      me.viewId = "cid" + corder;
      me.getChapterContent(me.cinfo.chapterUrl);
    },

    //打开目录
    openclist() {
      this.$refs.opbottom.close();
      this.$refs.clistdrawer.open();
    },
    //打开设置
    opensetting() {
      this.$refs.opbottom.close();
      this.$refs.fontandcolor.open();
    },
    //打开底部的操作菜单
    showopview() {
      this.$refs.opbottom.open();
    },

    fontSizeMove() {
      let Size = this.fontSizeSlider;
      if (Size > 1) {
        let num = Size - 1;
        this.fontSizeSlider = num;
        this.SetFontSize(num);
      }
    },
    fontSizeAdd() {
      let Size = this.fontSizeSlider;
      if (Size < 8) {
        let num = Size + 1;
        this.fontSizeSlider = num;
        this.SetFontSize(num);
      }
    },
    fontSizeChange(e) {
      let num = e.detail.value;
      this.SetFontSize(num);
    },
    SetFontSize(num) {
      if (num == 1) {
        this.fontSize = 0.875;
      } else if (num == 2) {
        this.fontSize = 1;
      } else if (num == 3) {
        this.fontSize = 1.125;
      } else if (num == 4) {
        this.fontSize = 1.25;
      } else if (num == 5) {
        this.fontSize = 1.375;
      } else if (num == 6) {
        this.fontSize = 1.5;
      } else if (num == 7) {
        this.fontSize = 1.625;
      } else if (num == 8) {
        this.fontSize = 1.75;
      }
    },
    skinCheckbox(index, key) {
      let items = this.skinData;
      for (let i = 0, lenI = items.length; i < lenI; ++i) {
        this.skinData[i].checked = false;
      }
      this.skinData[index].checked = true;
      this.skinValue = key;
    },
    layoutCheckbox(index, key) {
      let items = this.layoutData;
      for (let i = 0, lenI = items.length; i < lenI; ++i) {
        this.layoutData[i].checked = false;
      }
      this.layoutData[index].checked = true;
      this.layoutValue = key;
    },
  },
};
</script>

<style>
@import url("readbook.css");
</style>
