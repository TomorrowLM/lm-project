<template>
  <el-header class="header">
    <div>header</div>
    <div class="float-right"></div>
    <div>
      <el-button @click="onchange(1)">切换皮肤</el-button>
    </div>
  </el-header>
</template>

<script lang="ts" setup>
import {
  Document,
  Menu as IconMenu,
  Location,
  Setting,
} from "@element-plus/icons-vue";
const onchange = (event: number) => {
  console.log(event);
  if (document.documentElement.getAttribute("data-theme") === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", "dark"); //set theme to light
  }
};
</script>

<style lang="scss" scoped>
.el-header {
  border: 1px solid #ccc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: $header-bg-color;
}
</style>
