<script setup lang="ts">
import SiderBar from "@/components/Layout/SiderBar.vue";
import Header from "@/components/Layout/Header.vue";
import AddProject from "@/components/BusinessCom/AddProject/index.vue";
import { computed, watch, ref } from "vue";
import { useStore, mapState } from "vuex";
// console.log(
//   "[App.vue]",
//   `Hello world from Electron ${process.versions.electron}!`
// );
</script>

<template>
  <div class="app">
    <Header></Header>
    <el-container>
      <el-aside width="200px">
        <sider-bar></sider-bar>
      </el-aside>
      <el-container>
        <el-main><router-view></router-view></el-main>
      </el-container>
    </el-container>

    <AddProject></AddProject>
  </div>
</template>

<style lang="scss" scoped>
.app {
  // height: 100vh;
}

.el-container {
  height: 100%;
}

.el-aside {
  background: $header-bg-color;
}
</style>
