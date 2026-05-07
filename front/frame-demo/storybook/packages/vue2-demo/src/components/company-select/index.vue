<!--
 * @Descripttion: 选择组件
 * @Author: Claude
 * @Date: 2024-03-21
-->
<template>
  <div class="custom-select custom-select-wrapper">
    <!-- 名称输入框 -->
    <van-field
      v-model="fieldText"
      :label="label"
      :placeholder="placeholder"
      :rules="rules"
      :required="required"
      readonly
      right-icon="arrow"
      @click="openPicker"
    />

    <!-- 选择弹出层 -->
    <van-popup
      v-model="showPicker"
      position="bottom"
      style="height: 60%"
      :get-container="getContainer"
    >
      <div class="custom-picker">
        <!-- 选择弹出层头部 -->
        <div class="picker-header">
          <span
            class="cancel van-picker__cancel"
            @click="onCancel"
            v-if="showPickerHandle"
            >取消</span
          >
          <span class="title">选择{{ title }}</span>
          <span class="confirm" @click="onConfirm" v-if="showPickerHandle"
            >确定</span
          >
        </div>
        <!-- 搜索框 -->
        <van-search
          v-model="searchValue"
          :placeholder="searchPlaceholder"
          @input="onSearch"
        />
        <!-- 选择列表 -->
        <div class="custom-list" @scroll="handleScroll">
          <van-cell-group>
            <van-cell
              v-for="(item, index) in list"
              :key="index"
              :title="item[filedProps.label]"
              @click="selectCell(item)"
              :class="{
                active: isSelected(item),
              }"
            >
              <template #right-icon>
                <van-checkbox
                  v-if="isMultiple"
                  v-model="item.checked"
                  @click.stop
                  @change="(checked) => onCheckboxChange(checked, index, item)"
                />
              </template>
            </van-cell>
          </van-cell-group>
          <div v-if="loading" class="loading-more">
            <van-loading type="spinner" size="24px">加载中...</van-loading>
          </div>
          <div v-if="finished" class="no-more">没有更多了</div>
        </div>
        <!-- 底部确认按钮 -->
        <div class="bottom-button" v-if="isMultiple">
          <van-button type="info" block round @click="onConfirm"
            >确定</van-button
          >
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script>
import {
  Field,
  Popup,
  Search,
  Cell,
  CellGroup,
  Loading,
  Toast,
  Checkbox,
  Button,
} from "vant";

export default {
  name: "picker-field",

  components: {
    [Field.name]: Field,
    [Popup.name]: Popup,
    [Search.name]: Search,
    [Cell.name]: Cell,
    [CellGroup.name]: CellGroup,
    [Loading.name]: Loading,
    [Checkbox.name]: Checkbox,
    [Button.name]: Button,
  },

  props: {
    value: {
      type: [String, Array],
      default: () => "",
    },
    // 标题
    title: {
      type: String,
      default: "选择",
    },
    required: {
      type: Boolean,
      default: true,
    },
    // 规则
    rules: {
      type: Array,
      default: () => [{ required: true, message: "" }],
    },
    // popup的位置
    getContainer: {
      type: String,
      default: () => "body",
    },
    showPickerHandle: {
      type: Boolean,
      default: true,
    },
    // 获取数据
    getData: {
      type: Function,
      required: true,
    },
    // 是否多选模式
    isMultiple: {
      type: Boolean,
      default: false,
    },
    // 自定义字段名配置
    filedProps: {
      type: Object,
      default: () => ({
        label: "label",
        value: "value",
      }),
    },
  },

  computed: {
    label() {
      return `${this.title}名称`;
    },
    placeholder() {
      return `请输入${this.title}名称`;
    },
    searchPlaceholder() {
      return `请输入${this.title}名称`;
    },
  },
  data() {
    return {
      showPicker: false,
      searchValue: "",
      selectedData: null, // 单选模式下存储选中
      selectedCompanies: [], // 多选模式下存储选中
      fieldText: this.value,
      page: 1,
      pageSize: 10,
      loading: false,
      finished: false,
      list: [], // 列表数据
    };
  },

  watch: {
    value: {
      immediate: true,
      handler(newVal) {
        if (this.isMultiple) {
          this.selectedCompanies = Array.isArray(newVal) ? newVal : [];
          this.fieldText = this.selectedCompanies
            .map((item) => item[this.filedProps.label])
            .join("、");
          // 初始化列表项的checked状态
          this.list.forEach((item) => {
            this.$set(
              item,
              "checked",
              this.selectedCompanies.some(
                (selected) =>
                  selected[this.filedProps.value] ===
                  item[this.filedProps.value]
              )
            );
          });
        } else {
          this.fieldText = newVal;
        }
      },
    },
    showPicker: {
      handler(newVal) {
        console.log("newVal", newVal);
        if (!newVal) {
          this.reset();
          this.updateList([]);
        }
      },
    },
  },
  mounted() {
    console.log("123mounted");
    this.$emit("mounted", this);
  },
  methods: {
    // 判断是否选中
    isSelected(item) {
      if (this.isMultiple) {
        return item.checked;
      }
      return (
        this.selectedData &&
        this.selectedData[this.filedProps.value] === item[this.filedProps.value]
      );
    },

    // 打开选择器
    openPicker() {
      this.showPicker = true;
    },

    // 重置
    reset() {
      this.searchValue = "";
      this.page = 1;
      this.finished = false;
      this.loading = false;
    },

    // 搜索
    async onSearch(value) {
      this.searchValue = value;
      this.page = 1;
      this.finished = false;
      this.loading = false;

      if (value.length < 2) {
        this.updateList([]);
        return;
      }

      try {
        this.loading = true;
        Toast.loading({
          message: "搜索中...",
          forbidClick: true,
        });

        await this.getData({
          nsrmc: value,
          page: this.page,
          size: this.pageSize,
          isSearch: true,
        });
      } finally {
        this.loading = false;
        Toast.clear();
      }
    },

    // 处理滚动加载
    handleScroll(e) {
      const scrollEl = e.target;
      if (!scrollEl) return;

      const { scrollHeight, scrollTop, clientHeight } = scrollEl;
      if (
        scrollHeight - scrollTop - clientHeight < 20 &&
        !this.loading &&
        !this.finished
      ) {
        this.loadMore();
      }
    },

    // 加载更多数据
    async loadMore() {
      if (this.loading || this.finished || !this.searchValue) return;

      try {
        this.loading = true;
        await this.getData({
          nsrmc: this.searchValue,
          page: this.page + 1,
          size: this.pageSize,
          isLoadMore: true,
        });
      } finally {
        this.loading = false;
      }
    },

    // 更新列表数据
    updateList(list) {
      if (this.isMultiple) {
        // 为每个列表项添加checked属性
        list.forEach((item) => {
          this.$set(
            item,
            "checked",
            this.selectedCompanies.some(
              (selected) =>
                selected[this.filedProps.value] === item[this.filedProps.value]
            )
          );
        });
      }
      console.log(list, "list");
      this.list = list;
    },

    // 设置加载状态
    setLoading(status) {
      this.loading = status;
    },

    // 设置完成状态
    setFinished(status) {
      this.finished = status;
    },

    // Checkbox 改变事件
    onCheckboxChange(checked, index, item) {
      this.$set(this.list[index], "checked", checked);

      if (checked) {
        this.selectedCompanies.push(item);
      } else {
        const idx = this.selectedCompanies.findIndex(
          (i) => i[this.filedProps.value] === item[this.filedProps.value]
        );
        if (idx > -1) {
          this.selectedCompanies.splice(idx, 1);
        }
      }
      this.$emit("select", this.selectedCompanies);
    },

    // 选择
    selectCell(item) {
      if (this.isMultiple) {
        const index = this.list.findIndex(
          (item) => item[this.filedProps.value] === item[this.filedProps.value]
        );
        if (index > -1) {
          this.onCheckboxChange(!this.list[index].checked, index, item);
        }
      } else {
        this.selectedData = item;
        this.$emit("select", item);
      }
    },

    // 取消选择
    onCancel() {
      this.showPicker = false;
      this.updateList([]);
      this.$emit("cancel");
      this.reset();
    },

    // 确认选择
    onConfirm() {
      if (this.isMultiple) {
        this.fieldText = this.selectedCompanies
          .map((item) => item[this.filedProps.label])
          .join("、");
        this.$emit("confirm", this.selectedCompanies);
      } else if (this.selectedData) {
        this.fieldText = this.selectedData[this.filedProps.label];
        this.$emit("confirm", this.selectedData);
      }
      this.showPicker = false;
    },
  },
};
</script>

<style lang="scss" scoped>
.custom-select {
  &.custom-select-wrapper {
    width: 100%;
  }

  // /deep/ .van-cell {
  //   display: flex;
  //   flex-direction: column;

  //   &::after {
  //     left: 0;
  //     display: none;
  //   }

  //   &::before {
  //     left: 0;
  //   }

  //   .van-field__label {
  //     position: absolute;
  //     color: rgba(17, 31, 44, 1);
  //     font-size: 1rem;
  //     font-weight: 500;
  //   }

  //   &.van-cell--required {
  //     .van-field__label {
  //       margin-left: 0.5rem !important;
  //     }
  //   }

  //   .van-field__value {
  //     margin-top: 2.25rem;
  //     flex-shrink: 0;
  //     padding: 0.75rem;
  //     border-radius: 0.5rem;
  //     background: rgba(248, 249, 250, 1);
  //   }
  // }
}

// // 使用更具体的选择器来隔离弹出层样式
.van-popup {
  .custom-picker {
    padding: 0;
    height: 100%;
    display: flex;
    flex-direction: column;

    .picker-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: #fff;
      border-bottom: 1px solid #ebedf0;

      .title {
        font-weight: 500;
        font-size: 16px;
        margin: auto;
      }

      // .cancel {
      // }
      .confirm {
        color: #1989fa;
        font-size: 14px;
        padding: 0 16px;
      }
    }

    .van-search {
      flex-shrink: 0;
      padding: 8px 16px;

      .van-cell {
        display: inline-block;
        background-color: #f7f8fa;
        border-radius: 4px;
        display: flex;
      }

      .van-field__value {
        margin-top: 0;
      }
    }

    .custom-list {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      position: relative;
      height: 0; // 这是关键，确保flex布局下滚动正常

      .van-cell-group {
        background-color: transparent;
        padding: 0 16px;
      }

      .van-cell {
        padding: 12px;
        margin: 0;
        border-bottom: 1px solid #ebedf0;
        background-color: transparent;

        &.active {
          background-color: #f2f8ff;
          color: #1989fa;
        }

        &:active {
          background-color: #f8f8f8;
        }
      }

      .loading-more,
      .no-more {
        text-align: center;
        padding: 12px 16px;
        color: #969799;
        font-size: 14px;
      }
    }

    .bottom-button {
      padding: 16px;
      background: #fff;
    }
  }
}
</style>
