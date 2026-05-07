<template>
  <view>
    <navigator url="/pages/user/login/login">
      <button type="primary">登录</button>
    </navigator>
    <navigator url="/pages/user/register/register">
      <button type="primary">注册</button>
    </navigator>
    <navigator url="/pages/user/forgot/forgot">
      <button type="primary">忘记密码</button>
    </navigator>
    <navigator url="/pages/user/modify/modify">
      <button type="primary">修改密码</button>
    </navigator>
    <navigator url="/pages/user/info/info">
      <button type="primary">信息设置</button>
    </navigator>
  </view>
</template>

<script>
  export default {
    data() {
      return {};
    },
    mounted() {}
  }
</script>

<style>
  button {
    margin-top: 40upx;
  }
</style>
