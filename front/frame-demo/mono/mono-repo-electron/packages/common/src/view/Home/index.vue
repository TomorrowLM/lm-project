<template>
  <div>
    <custom-form :formList="data"></custom-form>
    <el-button @click="click">Mock动态组件</el-button>
  </div>
</template>
<script setup lang="ts">
import Vue, { reactive, ref } from "vue";
import { getData } from "@packages/common/api/test.ts";

let data: any = reactive<any>({});
function click() {
  getData().then((res: any) => {
    console.log(res);
    data.value = res.data;
    console.log(data);
  });
}
</script>
<style>
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo.electron:hover {
  filter: drop-shadow(0 0 2em #9feaf9);
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
