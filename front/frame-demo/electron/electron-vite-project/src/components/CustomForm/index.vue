<template>
  <div v-if="!isEmpty(formList.value)">
    <div v-for="(item, index) in formList.value.panels" :key="index">
      <div class="header mar-b-16">{{ item.title }}</div>
      <div class="form">
        <el-form :rules="rules" :inline="true" :model="formData" label-width="120px">
          <el-form-item
            v-for="(formItem, formIndex) in Object.keys(item.elements)"
            :key="formIndex"
            :label="`${item.elements[formItem].label}：`"
            :style="{ width: item.elements[formItem].width }"
            :prop="formItem"
          >
            <!-- {{ formItem }} -->
            <el-input
              v-if="item.elements[formItem].type === 'input'"
              v-model="formData[formItem]"
              :placeholder="`请输入${item.elements[formItem].label}`"
            />
            <el-select
              v-else-if="item.elements[formItem].type === 'select'"
              v-model="formData[formItem]"
              :placeholder="`请选择${item.elements[formItem].label}`"
            >
              <el-option
                v-for="optionItem in item.elements[formItem].newOptions || item.elements[formItem].options"
                :key="optionItem.value"
                :label="optionItem.key"
                :value="optionItem.value"
                :placeholder="`请选择${item.elements[formItem].label}`"
              />
            </el-select>
            <el-input
              type="textarea"
              autosize
              v-else-if="item.elements[formItem].type === 'textarea'"
              v-model="formData[item.elements[formItem].key]"
              :placeholder="`请输入${item.elements[formItem].label}`"
            />
            <div v-else-if="item.elements[formItem].type === 'checkbox'">
              <el-checkbox
                v-for="checkItem in item.elements[formItem].options"
                :key="checkItem.key"
                :label="checkItem.key"
                :value="checkItem.value"
                :true-label="checkItem.key"
                :false-label="checkItem.key"
                v-model="formData[formItem]"
              />
            </div>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 自动化表单
 */
import { reactive, ref, toRefs, watchEffect, watch, defineProps } from "vue";
import { cloneDeep, isEmpty } from "lodash";
const props = defineProps<{
  formList: any;
}>();
const formList = reactive<any>([]);

const formData: any = reactive<object>({});

const rules = reactive<any>({
  // pass: [{ validator: validatePass, trigger: 'blur' }],
  // checkPass: [{ validator: validatePass2, trigger: 'blur' }],
  // age: [{ validator: checkAge, trigger: 'blur' }],
});

interface RuleListProps {
  methodType: string; //事件规则
  actions: Array<{
    actionType: string;
    options?: Array<any>;
    action: any;
    rule: string;
  }>;
}

const change = (ruleList: RuleListProps) => {
  console.log(ruleList);
  return (rule: any, value: any, callback: any) => {
    ruleList.actions.forEach((ruleItem: any) => {
      if (ruleItem.actionType === "changeOptions" && eval(ruleItem.rule)) {
        // console.log(formList[]);
        let data: any = eval(ruleItem.changeKey);
        data.newOptions = ruleItem.options;
      }
      if (ruleItem.actionType === "changeOptions" && !eval(ruleItem.rule) && eval(ruleItem.changeKey).newOptions) {
        let data: any = eval(ruleItem.changeKey);
        data.newOptions = null;
      }
      if (ruleItem.actionType === "changeFormData" && eval(ruleItem.rule)) {
        formData[ruleItem.changeKey] = ruleItem.changeVal;
      }
    });
  };
};

const blur = (ruleList: RuleListProps) => {
  console.log(ruleList);
  return (rule: any, value: any, callback: any) => {
    ruleList.actions.forEach((element: any) => {
      if (element.actionType === "reg") {
        // console.log(element.rule, new RegExp(element.rule), value);
        if (new RegExp(element.rule).test(value)) {
          callback();
        } else {
          callback(new Error(element.ruleMessage));
        }
      }
    });
  };
};

const setData = () => {
  console.log(props.formList.value);
  formList.value = cloneDeep(props.formList.value);
  console.log(formList.value, isEmpty(formList.value), formList.value);
  !isEmpty(formList.value) &&
    formList.value.panels.forEach((valP: any, indexP: Number) => {
      Object.keys(valP.elements).forEach((valC: any, indexC: Number) => {
        formData[valC] = valP.elements[valC].defaultValue;
        rules[valC] = [];
        if (valP.elements[valC].methods) {
          valP.elements[valC].methods.forEach((actionsVal: any) => {
            if (actionsVal.methodType === "change") {
              console.log(88888888888888, actionsVal);
              rules[valC].push({ trigger: "change", validator: change(actionsVal) });
            } else if (actionsVal.methodType === "blur") {
              rules[valC].push({ trigger: "blur", validator: blur(actionsVal) });
            }
          });
        }
      });
    });
  console.log(rules, formData);
};

watch(
  props.formList,
  (newValue, oldValue) => {
    console.log("person变化了", newValue, oldValue);
    setData();
  },
  { immediate: true, deep: false }
);

// onMounted(() => {
//   setData();
// });
</script>

<style lang="scss" scoped>
form {
  display: flex;
  flex-wrap: wrap;
}
.el-form--inline .el-form-item {
  margin-right: 0;
  display: flex;
  align-items: center;
}
</style>
