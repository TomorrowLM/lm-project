<template>
  <view class="page-head">
    <view class="page">
      <view class="fictionwrap">
        <text>{{ textlocal }}</text>
      </view>
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
      addBtn: false,
      textlocal: "",
    };
  },
  onLoad(e) {
	  console.log(e)
    //章节目录的高度动态获取
    uni.getSystemInfo({
      success(res) {
        this.windowHeight = res.windowHeight - 126 + "px";
      },
    });
    let path = e.path;
    let arr = path.split("/");
    arr.splice(0, 5);
    let that = this;
    function onPlusReady() {
      var url = "../../../../../..";
      // arr.forEach((value, index) => {
      //   url += "/" + value;
      // });
	  url+='/三体.txt'
	  console.log(url)
      //将本地URL路径转换成平台绝对路径
      // var path = plus.io.convertLocalFileSystemURL(url);
      //将平台绝对路径转换成本地URL路径
      // path=plus.io.convertAbsoluteFileSystem(url);
      // console.log(path);
      //请求本地文件系统对象
      plus.io.requestFileSystem(
        plus.io.PRIVATE_WWW,
        function (fs) {
          console.log(fs.root.fullPath);
          var a;
          fs.root.getFile(
            url,
            {
              create: true,
            },
            function (fileEntry) {
              fileEntry.file(function (file) {
                var fileReader = new plus.io.FileReader();
                console.log("getFile:" + JSON.stringify(file));
				console.log(file)
                fileReader.readAsText(file, "GB2312");
                fileReader.onloadend = function (evt) {
                  // console.log("evt.target" + evt.target);
                  // console.log(evt.target.result);
                  that.textlocal = evt.target.result;
                  var reg = new RegExp("&quot;", "g");
                  var a = that.textlocal.replace(reg, "");
                  that.textlocal = a;
                };
                console.log(file.size + "--" + file.name);
              });
            }
          );
          return a;
        },
        function (e) {
          console.log("Request file system failed: " + e.message);
        }
      );

      //通过URL参数获取目录对象或文件对象
      plus.io.resolveLocalFileSystemURL(path, function (entry) {
        entry.file(function (file) {
          var fileReader = new plus.io.FileReader();
          fileReader.readAsText(file, "GB2312");
          fileReader.onload = function (e) {};
        });
      });
    }
    onPlusReady();
  },

  methods: {
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
@import url("local.css");
</style>
