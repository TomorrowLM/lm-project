/**
 * @author : Claude
 * @date : 2024-03-21
 * @module : company-select
 * @description : 公司选择组件 story
 */

import CompanySelect from "../../components/company-select/index.vue";
import { mockSearchCompanies } from "./mockData";

export default {
  title: "vue2/mobile/company-select",
  component: CompanySelect,
  argTypes: {
    title: { control: "text" },
    required: { control: "boolean" },
    isMultiple: { control: "boolean" },
    showPickerHandle: { control: "boolean" },
  },
};

// 基础模板
const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { CompanySelect },
  data() {
    return {
      companySelectInstance: null,
    };
  },
  template: `
    <div style="padding: 20px;">
      <CompanySelect
        v-bind="$props"
        :getData="getData"
        @mounted="onMounted"
        @select="onSelect"
        @confirm="onConfirm"
        @cancel="onCancel"
      />
    </div>
  `,
  methods: {
    onMounted(instance) {
      this.companySelectInstance = instance;
    },
    async getData(params) {
      const { list, hasMore } = await mockSearchCompanies(params);
      console.log(this, "this.companySelectInstance");
      // 这里可以安全调用
      if (this.companySelectInstance) {
        this.companySelectInstance.updateList([
          ...this.companySelectInstance.list,
          ...list,
        ]);
        // 更新加载状态
        this.companySelectInstance.setLoading(false);

        // 更新完成状态
        this.companySelectInstance.setFinished(list.length < params.size);
      }
      return { list, hasMore };
    },
    onSelect(data) {
      console.log("选择数据:", data);
    },
    onConfirm(data) {
      console.log("确认数据:", data);
    },
    onCancel() {
      console.log("取消选择");
    },
  },
});

// 单选模式
export const SingleSelect = Template.bind({});
SingleSelect.args = {
  title: "公司",
  filedProps: {
    label: "nsrmc",
    value: "id",
  },
  required: true,
  isMultiple: false,
  showPickerHandle: true,
};

// 多选模式
export const MultipleSelect = Template.bind({});
MultipleSelect.args = {
  title: "公司",
  required: true,
  isMultiple: true,
  showPickerHandle: true,
};
