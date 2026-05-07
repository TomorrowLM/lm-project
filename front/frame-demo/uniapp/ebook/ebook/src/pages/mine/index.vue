<template>
  <view>
    <view class="person-head">
      <cmd-avatar
        src=""
        @click="fnInfoWin"
        size="lg"
        :make="{ 'background-color': '#fff' }"
      ></cmd-avatar>
      <view class="person-head-box">
        <view class="person-head-nickname"></view>
        <view class="person-head-username" v-if="!username"
          >ID：
          <span @click="login" v-if="!username">登陆</span>
          <span @click="register">/注册</span>
        </view>
        <view class="person-head-username" v-if="username"
          >ID：
          <span>{{ username }}</span>
        </view>
      </view>
    </view>
    <view class="person-list">
      <cmd-cell-item title="我的书籍" slot-left arrow @click="openBooklist">
        <cmd-icon type="alert-circle" size="24" color="#368dff"></cmd-icon>
      </cmd-cell-item>
      <cmd-cell-item title="我的收藏" slot-left arrow @click="collect">
        <cmd-icon type="bullet-list" size="24" color="#368dff"></cmd-icon>
      </cmd-cell-item>
      <cmd-cell-item title="修改账号和密码" slot-left arrow  @click='fixSecurity'>
        <cmd-icon type="message" size="24" color="#368dff"></cmd-icon>
      </cmd-cell-item>
      <cmd-cell-item title="清除用户信息" slot-left arrow @click='clearInfo'>
        <cmd-icon type="settings" size="24" color="#368dff"></cmd-icon>
      </cmd-cell-item>
      <cmd-cell-item title="版本信息" slot-left arrow @click='banbenInfo'>
        <cmd-icon type="alert-circle" size="24" color="#368dff"></cmd-icon>
      </cmd-cell-item>
    </view>
          <uni-popup ref="popup1" type="dialog">
            <uni-popup-dialog
              type="error"
              message="12"
              :duration="2000"
              :before-close="true"
              @close="close"
              @confirm="confirm"
              title="是否清除所有数据"
            ></uni-popup-dialog>
          </uni-popup>
		  <uni-popup ref="popup2" type="center">
		     <uni-popup-message type="info" message="当前版本为V1.1" :duration="2000"></uni-popup-message>
		  </uni-popup>
      	<tan-chu></tan-chu>
	</view>
</template>

<script>
import cmdAvatar from "@/components/cmd-person_1.1/components/cmd-avatar/cmd-avatar.vue";
import cmdIcon from "@/components/cmd-person_1.1/components/cmd-icon/cmd-icon.vue";
import cmdCellItem from "@/components/cmd-person_1.1/components/cmd-cell-item/cmd-cell-item.vue";
import tanChu from "@/components/a-tanchu/tanchu.vue";
import uniPopup from "@/components/uni-popup/uni-popup.vue";
import uniPopupMessage from "@/components/uni-popup/uni-popup-message.vue";
import uniPopupDialog from "@/components/uni-popup/uni-popup-dialog.vue";
export default {
  components: {
    cmdAvatar,
    cmdCellItem,
    cmdIcon,
	  tanChu,
	  uniPopup,
	  uniPopupMessage,
	  uniPopupDialog,
  },
  data() {
    return {
      username: '',
	  show: false
    }
  },
  created() {
    this.username = this.$store.state.username;
  },
  activated() {
    document.getElementsByTagName("uni-page-wrapper")[0].style.background =
      "white";
  },
  methods: {
    fixSecurity(){
      this.$store.state.fixSecurity = true
    },
	  clearInfo(){
		 this.$refs.popup1.open()
	  },
	  banbenInfo(){
		  this.$refs.popup2.open()
	  },
	  close(done) {
	    // TODO 做一些其他的事情，before-close 为true的情况下，手动执行 done 才会关闭对话框
	    // ...
	    done();
	  },
	  confirm(done, value) {
	    this.$store.commit('bookshelfClear',[])
	    done();  		
	  },
    /**
     * 打开用户信息页
     */
    fnInfoWin() {
      uni.navigateTo({
        url: "/pages/user/info/info",
      });
    },
    login() {
      uni.navigateTo({
        url: "/pages/user/login/login",
      });
    },
    register() {
      uni.navigateTo({
        url: "/pages/user/register/register",
      });
    },
    openBooklist() {
      uni.switchTab({
        url: "/pages/book/index",
      });
    },
	collect(){
		console.log(1)
		uni.navigateTo({
		  url: "/pages/mine/collect",
		});

	}
  },
};
</script>

<style>
@import url("./index.css");
</style>
