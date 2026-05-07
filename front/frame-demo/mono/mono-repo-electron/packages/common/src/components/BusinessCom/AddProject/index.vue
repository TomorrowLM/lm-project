<script setup lang="ts">
import { computed, watch, ref } from "vue";
import { useStore, mapState } from "vuex";
import lodash from "lodash";
const store = useStore();
const projectName = ref<string>("");
const createProject = computed(() => {
  console.log(store.state, 999);
  return store.state.mainProcess.createProject;
});
const router = computed(() => {
  // console.log(store.state, 999);
  return store.state.router.route;
});
let route: any = [];
let loadNode: any = ref<Array<any>>([
  {
    name: `设备${router.value.length + 1}`,
    title: "设备",
    path: "device",
    component: () => import("../../../view/routerView.vue"),
    children: [
      {
        name: `设备组一${router.value.length + 1}device`,
        title: "设备组一",
        path: "device-one",
        component: () => import("../../../view/Device/index.vue"),
        meta: {
          sidebar: true, // 在侧边栏显示
          title: "设备组一",
        },
        // children: [
        //   {
        //     title: "Level three 1-1-1",
        //   },
        //   {
        //     title: "Level three 1-1-2",
        //   },
        // ],
      },
      {
        name: `设备组二${router.value.length + 1}device`,
        title: "设备组二",
        path: "device-two",
        component: () => import("../../../view/Device/index.vue"),
        meta: {
          sidebar: true, // 在侧边栏显示
          title: "设备组二",
        },
        // children: [
        //   {
        //     title: "Level three 1-1-1",
        //   },
        // ],
      },
    ],
    meta: {
      sidebar: true, // 在侧边栏显示
      title: "设备",
    },
  },
]);
watch(createProject, (newValue, oldValue) => {}, { immediate: true });
watch(
  router,
  (newValue, oldValue) => {
    loadNode = [
      {
        name: `设备${router.value.length + 1}`,
        title: "设备",
        path: "device",
        component: () => import("../../../view/routerView.vue"),
        children: [
          {
            name: `设备组一${router.value.length + 1}device`,
            title: "设备组一",
            path: "device-one",
            component: () => import("../../../view/Device/index.vue"),
            meta: {
              sidebar: true, // 在侧边栏显示
              title: "设备组一",
            },
            // children: [
            //   {
            //     title: "Level three 1-1-1",
            //   },
            //   {
            //     title: "Level three 1-1-2",
            //   },
            // ],
          },
          {
            name: `设备组二${router.value.length + 1}device`,
            title: "设备组二",
            path: "device-two",
            component: () => import("../../../view/Device/index.vue"),
            meta: {
              sidebar: true, // 在侧边栏显示
              title: "设备组二",
            },
            // children: [
            //   {
            //     title: "Level three 1-1-1",
            //   },
            // ],
          },
        ],
        meta: {
          sidebar: true, // 在侧边栏显示
          title: "设备",
        },
      },
    ];
  },
  { immediate: true }
);

const handleClose = () => {
  store.commit("setCreateProject", false);
};

const confirm = (e: any) => {
  console.log(route);
  store.commit("setRoute", {
    path: `/project${router.value.length + 1}`,
    component: () => import("../../../view/routerView.vue"),
    name: projectName.value,
    title: projectName.value,
    meta: {
      title: projectName.value, // 设置该路由在侧边栏和面包屑中展示的名字
      sidebar: true, // 在侧边栏显示
    },
    children: route,
  });
  store.commit("setCreateProject", false);
};

const defaultProps = {
  children: "children",
  label: "title",
};
const selectTree = null;
let treeRef = ref();
const handleCheckChange = (data: any, obj: any, da: any) => {
  // console.log(data, obj, da, treeRef);
  console.log(
    treeRef.value.getHalfCheckedNodes(),
    treeRef.value.getCheckedNodes()
  );
  route = getSimpleCheckedNodes(
    lodash.cloneDeep(treeRef.value.store.root.childNodes)
  );
};

const getSimpleCheckedNodes = (store: any) => {
  const keys = treeRef.value
    .getHalfCheckedNodes()
    .map((element: any, index: number) => {
      return element.$treeNodeId;
    });
  console.log(keys);
  // 定义数组
  let checkedNodes: any = [];
  // 判断是否为全选，若为全选状态返回被全选的节点，不为全选状态正常返回被选中的节点
  const traverse = function (node: any, data: any) {
    // console.log(node.root);
    // const childNodes: any = [];
    // node.root ? node.root.childNodes : node.childNodes;childNodes
    console.log(node, keys, data);
    node.forEach((element: any, index: number) => {
      // console.log(element.isLeaf);
      if (element.isLeaf && element.checked) {
        data.push(element.data);
      } else if (element) {
        // console.log(keys.includes(element.id));
        if (keys.includes(element.id) || element.checked) {
          data.push(element.data);
          // (data[index] as any) = element.data;
          // console.log(data[index]);
          data[index].children = [];
          traverse(element.childNodes, data[index].children);
        }
      }
    });
  };

  traverse(store, checkedNodes);
  console.log(checkedNodes);
  return checkedNodes;
};
// const getDivDom = (el: any) => {
//   if (el) {
//     treeRef = el;
//   }
//   console.log(treeRef);
// };
</script>

<template>
  <el-dialog
    v-model="createProject"
    title="创建项目"
    width="30%"
    :before-close="handleClose"
  >
    <el-form>
      <el-form-item label="项目名：">
        <el-input v-model="projectName" placeholder="请输入项目名" />
      </el-form-item>
    </el-form>
    <el-tree
      ref="treeRef"
      :props="defaultProps"
      :data="loadNode"
      node-key="id"
      show-checkbox
      @check-change="handleCheckChange"
    />
    <template #footer>
      <el-button @click="confirm">确认</el-button>
      <el-button @click="handleClose">取消</el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.app {
  height: 100vh;
}

.el-container {
  height: 100%;
}
</style>
