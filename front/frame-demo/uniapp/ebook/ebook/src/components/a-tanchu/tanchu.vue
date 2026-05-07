<template>
  <view>
    <view v-if="this.$store.state.isShowInbook">
      <!-- 弹出层 -->
      <view class="uni-banner" style="background: #ffffff" v-if="bannerShow">
        <view style="justify-content: flex-end">
          <view
            style="justify-content: flex-end; text-align: right; padding: 20upx"
          >
            <text class="uni-icon uni-icon-close"></text>
          </view>
        </view>
        <view style="text-align: center;">
          是否添加 {{ this.$store.state.bookSelectName }}
        </view>
        <view
          style="
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: center;
            margin: 10px 0;
          "
        >
          <button
            type="primary"
            @click="add1"
            style="display: inline-block; width: 30vw"
          >
            确认添加
          </button>
          <button
            type="default"
            @click="close1"
            style="display: inline-block; width: 30vw"
          >
            取消
          </button>
        </view>
      </view>
      <view class="uni-mask" v-if="bannerShow"></view>
      <!-- 弹出层 -->
    </view>
    <view v-if="this.$store.state.isDeleteInbook">
      <!-- 弹出层 -->
      <view class="uni-banner" style="background: #ffffff" v-if="bannerShow">
        <view>
          <view style="text-align: center; margin: 10px 0">是否删除书籍</view>
        </view>
        <view
          style="
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: center;
            margin: 10px 0;
          "
        >
          <button
            type="primary"
            @click="add2"
            style="display: inline-block; width: 30vw"
          >
            确认删除
          </button>
          <button
            type="default"
            @click="close2"
            style="display: inline-block; width: 30vw"
          >
            取消
          </button>
        </view>
      </view>
      <view class="uni-mask" v-if="bannerShow"></view>
      <!-- 弹出层 -->
    </view>
	<view v-if="this.$store.state.isCollectbook">
	  <!-- 弹出层 -->
	  <view class="uni-banner" style="background: #ffffff" v-if="bannerShow">
	    <view>
	      <view style="text-align: center; margin: 10px 0" @click="addTobook">是否添加书籍到书架</view>
	    </view>
	    <view
	      style="
	        width: 100%;
	        display: flex;
	        flex-direction: row;
	        justify-content: center;
	        margin: 10px 0;
	      "
	    >
	      <button
	        type="primary"
	        @click="addTobook"
	        style="display: inline-block; width: 30vw"
	      >
	        确认添加
	      </button>
	      <button
	        type="default"
	        @click="close"
	        style="display: inline-block; width: 30vw"
	      >
	        取消
	      </button>
	    </view>
	  </view>
	  <view class="uni-mask" v-if="bannerShow"></view>
	  <!-- 弹出层 -->
	</view>
    <view v-if="this.$store.state.fixSecurity">
      <!-- 弹出层 -->
      <view
        class="uni-banner"
        style="background: #ffffff; height: 150px"
        v-if="bannerShow"
      >
        <view>
          <button style="text-align: center; margin: 20px 0" @click="add3">
            修改账号
          </button>
        </view>
        <view>
          <button style="text-align: center; margin: 20px 0" @click="close3">
            修改密码
          </button>
        </view>
        <!-- <view style="width: 100%; display: flex;flex-direction: row;justify-content:center;margin: 10px 0;">
					<button type='primary'  @click="add2"  style="display: inline-block;width: 30vw;">确认修改</button>
					<button type='default'  @click="close2"  style="display: inline-block;width: 30vw;">取消</button>				
				</view> -->
      </view>
      <view class="uni-mask" v-if="bannerShow"></view>
      <!-- 弹出层 -->
    </view>
    <view v-if="fixzhanghaoStatus">
      <!-- 弹出层 -->
      <view
        class="uni-banner"
        style="background: #ffffff; height: 150px"
        v-if="bannerShow"
      >
        <view style="text-align: center; margin: 10px 0">
          原账号：{{ oldzhanghao }}
        </view>
        <view>
          <input
            style="text-align: center; margin: 10px 0"
            @click="close3"
            placeholder="请输入账号"
            v-model="newzhanghao"
          />
        </view>
        <view
          style="
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: center;
            margin: 20px 0;
          "
        >
          <button
            type="primary"
            @click="fixzhanghao"
            style="display: inline-block; width: 30vw"
          >
            确认修改
          </button>
          <button
            type="default"
            @click="close"
            style="display: inline-block; width: 30vw"
          >
            取消
          </button>
        </view>
      </view>
      <view class="uni-mask" v-if="bannerShow"></view>
      <!-- 弹出层 -->
    </view>
    <view v-if="fixmimaStatus">
      <!-- 弹出层 -->
      <view
        class="uni-banner"
        style="background: #ffffff; height: 150px"
        v-if="bannerShow"
      >
        <view style="text-align: center; margin: 10px 0">
          <input
            style="text-align: center; margin: 10px 0"
            placeholder="原密码"
            v-model="oldmima"
          />
        </view>
        <view>
          <input
            style="text-align: center; margin: 10px 0"
            placeholder="请输入新的密码"
            v-model="newmima"
          />
        </view>
        <view style="text-align: center; margin: 10px 0" v-if="fixmimaShow">{{
          fixmimaRes ? "修改成功" : "密码不正确"
        }}</view>
        <view
          style="
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: center;
            margin: 20px 0;
          "
        >
          <button
            type="primary"
            @click="fixmima"
            style="display: inline-block; width: 30vw"
          >
            确认修改
          </button>
          <button
            type="default"
            @click="close"
            style="display: inline-block; width: 30vw"
          >
            取消
          </button>
        </view>
      </view>
      <view class="uni-mask" v-if="bannerShow"></view>
      <!-- 弹出层 -->
    </view>
  </view>
</template>
<script>
//保存登陆态
var SESSION_KEY = "denglutai";
export default {
  data() {
    return {
      bannerShow: false,
      fixzhanghaoStatus: false,
      fixmimaStatus: false,
      oldzhanghao: "",
      newzhanghao: "",
      oldmima: "",
      newmima: "",
      fixmimaShow: false,
      fixmimaRes: false,
    };
  },
  props: ["deleteEle"],
  created() {
    this.oldzhanghao = this.$store.state.username;
    // console.log(localStorage.getItem("username"))
    var session = uni.getStorageSync(SESSION_KEY);
    //如果存在session，已经登陆
    if (session) {
      //检测当前用户登录态是否有效
      var that = this;
      uni.checkSession({
        success: function() {
          that.bannerShow = false;
        },
        fail: function() {
          uni.removeStorageSync(SESSION_KEY);
          that.bannerShow = true;
        },
      });
    } else {
      this.bannerShow = true;
    }
  },
  onBackPress() {
    //app,h5 按返回键触发
    if (this.bannerShow) {
      uni.reLaunch({
        url: "/pages/index/index",
      });
    }
  },
  methods: {
	  addTobook(){
		  this.$store.commit('addCollectToshelf',this.deleteEle.currentTarget.id)
		  	  this.$store.state.isCollectbook = false;
	  },
    close() {
      this.fixzhanghaoStatus = false;
      this.fixmimaStatus = false;
      this.$store.state.fixSecurity = false;
	  this.$store.state.isCollectbook = false;
    },
    close1() {
      this.$store.state.isShowInbook = false;
      this.$store.commit("clearlocalbookshelf");
    },
    add1() {
      this.$store.state.isShowInbook = false;
    },
    close2() {
      this.$store.state.isDeleteInbook = false;
    },
    add2() {
	
      this.$store.state.bookshelf.forEach((value, index) => {
		  console.log(111)
        if (value.fictionId === this.deleteEle.currentTarget.id) {
          this.$store.state.bookshelf.splice(index, 1);
        }
      });
	  this.$store.state.localbookshelf.forEach((value, index) => {
	    console.log(this.$store.state.localbookshelf)
		if (value[1] === this.deleteEle.currentTarget.id) {
	      this.$store.state.localbookshelf.splice(index, 1);
	    }
	  });
      this.$store.state.isDeleteInbook = false;
    },
    add3() {
      this.$store.state.fixSecurity = false;
      this.fixzhanghaoStatus = true;
    },
    close3() {
      this.fixmimaStatus = true;
    },
    fixzhanghao() {
      uni.request({
        url: "http://127.0.0.1:8000/fixzhanghao", //仅为示例，并非真实接口地址。
        method: "POST",
        data: { newzhanghao: this.newzhanghao, oldzhanghao: this.oldzhanghao },
        header: {
          //   "custom-header": "hello", //自定义请求头信息
        },
        success: (res) => {
          console.log(res.data);
          this.text = "request success";
          localStorage.setItem("username", this.newzhanghao);
          this.$store.state.username = this.newzhanghao;
          location.reload();
        },
      });
    },
    fixmima() {
      uni.request({
        url: "http://127.0.0.1:8000/fixmima", //仅为示例，并非真实接口地址。
        method: "POST",
        data: {
          newmima: this.newmima,
          oldmima: this.oldmima,
          zhanghao: this.oldzhanghao,
        },
        header: {
          //   "custom-header": "hello", //自定义请求头信息
        },
        success: (res) => {
          console.log(res.data);
          if (res.data == "fail") {
            this.fixmimaShow = true;
          }
          this.fixmimaShow = true;
          this.fixmimaRes = true;
        },
      });
    },
  },
};
</script>

<style>
/* 遮罩层 */
.uni-mask {
  background: rgba(0, 0, 0, 0.6);
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  z-index: 9998;
}

/* 弹出层形式的广告 */
.uni-banner {
  width: 80%;
  position: fixed;
  left: 50%;
  top: 50%;
  background: #fff;
  border-radius: 10upx;
  z-index: 9999;
  transform: translate(-50%, -50%);
}
</style>
