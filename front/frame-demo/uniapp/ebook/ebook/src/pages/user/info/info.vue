<template>
  <view>
    <cmd-nav-bar back title="信息设置"></cmd-nav-bar>
    <cmd-page-body type="top">
      <cmd-transition name="fade-up">
        <view>
          <cmd-cel-item title="头像" slot-right arrow @click="chooseImage">
            <cmd-avatar
              :src="image"
			  ref="image1"
            ></cmd-avatar>
          </cmd-cel-item> 
          <cmd-cel-item title="昵称" :addon="username" arrow></cmd-cel-item>
          <cmd-cel-item title="姓名" addon="用户姓名" arrow></cmd-cel-item>
          <cmd-cel-item title="位置" :addon="address" arrow @click="addressActive"></cmd-cel-item>
          <button class="btn-logout" @click="exit">退出登录</button>
        </view>
      </cmd-transition>
    </cmd-page-body>
  </view>
</template>

<script>
import cmdNavBar from "@/components/cmd-person_1.1/components/cmd-nav-bar/cmd-nav-bar.vue";
import cmdPageBody from "@/components/cmd-person_1.1/components/cmd-page-body/cmd-page-body.vue";
import cmdTransition from "@/components/cmd-person_1.1/components/cmd-transition/cmd-transition.vue";
import cmdCelItem from "@/components/cmd-person_1.1/components/cmd-cell-item/cmd-cell-item.vue";
import cmdAvatar from "@/components/cmd-person_1.1/components/cmd-avatar/cmd-avatar.vue";

export default {
  components: {
    cmdNavBar,
    cmdPageBody,
    cmdTransition,
    cmdCelItem,
    cmdAvatar,
  },
  data() {
    return {
      username: this.$store.state.username,
    };
  },
  created() {

  },
  computed:{
	 image:{
		 get(){
			 return this.$store.state.image
		 }
	 },
	 address:{
		 get(){
			 return this.$store.state.address
		 }
	 }
  },
  updated() {
  	console.log(this.$refs.image1.$refs.image)
	console.log(this.$store.state.image) 
	// this.$refs.image1.$refs.image.style.src= this.$store.state.image
  },
  methods: {  
	  addressActive(){
		  uni.chooseLocation({
		      success: (res)=> {
		          // console.log('位置名称：' + res.name);
		          // console.log('详细地址：' + res.address);
		          // console.log('纬度：' + res.latitude);
		          // console.log('经度：' + res.longitude); 
				  this.$store.commit('addressActive',res.address)
		      }
		  });
	  },
	  chooseImage(){
		  // console.log(this)  
		  uni.chooseImage({
		      count: 1, //默认9
		      sizeType: ['original', 'compressed'], //可以指定是原图还是压缩图，默认二者都有
		      sourceType: ['album'], //从相册选择
		      success: (res)=> {
				  this.$store.commit("chooseImage",JSON.stringify(res.tempFilePaths[0]));	
				  // this.$refs.image.$el.style.height = '20px'
				  // console.log(this.$refs.image)
				  // console.log(this.$refs.image1.$refs.image)
				  // console.log(this.$store.state.image) 
				  // this.$refs.image1.$refs.image.style.src= this.$store.state.image 
		      }  
		  });
	  },
    /**
     * 点击触发
     * @param {Object} type 跳转页面名或者类型方式
     */
    fnClick(type) {
      if (type == "modify") {
        uni.navigateTo({
          url: "/pages/user/modify/modify",
        });
      }
    },
    exit() {
      // localStorage.removeItem("username");
	  this.$store.state.username = ''
      uni.switchTab({
        url: "/pages/mine/index",
      });
    },
  },
};
</script>

<style>
.btn-logout {
  margin-top: 100upx;
  width: 80%;
  border-radius: 50upx;
  font-size: 16px;
  color: #fff;
  background: linear-gradient(to right, #365fff, #36bbff);
}

.btn-logout-hover {
  background: linear-gradient(to right, #365fdd, #36bbfa);
}
</style>
