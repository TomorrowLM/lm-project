<script lang="ts" setup>
// import { routes } from "@/router/index";
import { useStore, mapState } from "vuex";
import { computed, watch, ref } from "vue";

const store = useStore();
const menuList: any = computed(() => {
  console.log(store, 999);
  return store.state.router.route;
});
console.log(menuList);
const defaultProps = {
  children: "children",
  label: "title",
};
</script>
<template>
  <!-- <el-menu>
    <template v-for="item in menuList">
      <el-menu-item
        v-if="
          item.meta.sidebar && (!item.children || item.children.length === 0)
        "
        :key="item.path"
        :index="item.path"
      >
        <router-link :to="item.path">{{ item.meta.title }}</router-link>
      </el-menu-item>
      <el-sub-menu
        v-if="item.children && item.children.length !== 0"
        :key="item.path"
        :index="item.path"
      >
        <template #title>
          <el-icon><location /></el-icon>
          <span>{{ item.meta.title }}</span>
        </template>
        <el-menu-item-group v-if="item.children">
          <el-menu-item
            v-for="child in item.children"
            :key="`${item.path}/${child.path}`"
            :index="`${item.path}/${child.path}`"
          >
            <router-link :to="`${item.path}/${child.path}`">
              {{ child.meta.title }}</router-link
            >
          </el-menu-item>
        </el-menu-item-group>
      </el-sub-menu>
    </template>
  </el-menu> -->
  <el-tree :props="defaultProps" :data="menuList" node-key="id">
    <template #default="{ data }">
      <!-- {{ data.name }} -->
      <router-link :to="{ name: data.name }">
        {{ data.title }}
      </router-link>
      <!-- <span>{{ node.label }}</span> -->
      <!-- <span>
        <router-link :to="{ name: data.title }">
          {{ data.title }}
        </router-link>
      </span> -->
    </template>
  </el-tree>
</template>
<style lang="scss" scoped>
.el-tree {
  background: $header-bg-color;
}
</style>
