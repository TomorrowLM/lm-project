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
            <template #label>
              <span>
                {{ item.elements[formItem].label }}
                <el-tooltip class="item" placement="top">
                  <!--  问号的图标   -->
                  <el-icon :size="15"><QuestionFilled /></el-icon>
                  <!--  提示的内容 -->
                  <template #content> 内容提示</template>
                </el-tooltip>
                <span>：</span>
              </span>
            </template>
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
import { reactive, ref, toRefs, watchEffect, watch } from "vue";
import { cloneDeep, isEmpty } from "lodash";
const props = defineProps<{
  formList: any;
}>();
const formList = reactive<any>([]);
const formData: any = reactive<object>({});
const rules = reactive<any>({});

interface RuleListProps {
  methodType: string; //事件规则
  rules: Array<{
    ruleType: string;
    options?: Array<any>;
    actions: any;
    rule: string;
  }>;
}

//找到对应key的数据
const loopBack = (key: string, list: any) => {
  console.log(list);
  for (let i = 0; i < list.length; i++) {
    const objKeys = Object.keys(list[i].elements);
    console.log(objKeys);
    for (let j = 0; j < objKeys.length; j++) {
      console.log(objKeys[j], key);
      if (objKeys[j] === key) {
        console.log(list[i]["elements"][key], 88888888);
        return list[i]["elements"][key];
      }
    }
  }
};

const ruleConfig = (type: string, rule: any) => {
  if (type === "bool") {
    const key = rule.match(/(?<=\[)(.+?)(?=\])/g)[0];
    const value = rule.match(/(?<====).+/g)[0];
    if (formData[key] === value) return true;
    return false;
  }
  return true;
};

const change = (ruleList: RuleListProps) => {
  return (rule: any, value: any, callback: any) => {
    ruleList.rules.forEach((ruleItem: any) => {
      console.log(ruleConfig("bool", ruleItem.rule));
      if (ruleItem.ruleType === "bool" && ruleConfig("bool", ruleItem.rule)) {
        ruleItem.actions.forEach((action: any) => {
          loopBack(action.changeKey, formList.value.panels).newOptions = action.options;
        });
      }
      //当条件不符合规则，将数据还原
      if (ruleItem.ruleType === "bool" && !ruleConfig("bool", ruleItem.rule)) {
        ruleItem.actions.forEach((action: any) => {
          loopBack(action.changeKey, formList.value.panels).newOptions = null;
        });
      }
      if (ruleItem.ruleType === "changeFormData" && eval(ruleItem.rule)) {
        formData[ruleItem.changeKey] = ruleItem.changeVal;
      }
    });
    callback();
  };
};

const blur = (ruleList: RuleListProps) => {
  return (rule: any, value: any, callback: any) => {
    ruleList.rules.forEach((ruleItem: any) => {
      if (ruleItem.ruleType === "reg") {
        console.log(ruleItem.rule, new RegExp(ruleItem.rule), value);
        if (new RegExp(ruleItem.rule).test(value)) {
          callback();
        } else {
          callback(new Error(ruleItem.ruleMessage));
        }
      }
    });
  };
};

const setData = () => {
  formList.value = cloneDeep(props.formList.value);
  !isEmpty(formList.value) &&
    formList.value.panels.forEach((valP: any, indexP: Number) => {
      Object.keys(valP.elements).forEach((valC: any, indexC: Number) => {
        formData[valC] = valP.elements[valC].defaultValue;
        rules[valC] = [];
        if (valP.elements[valC].methods) {
          valP.elements[valC].methods.forEach((actionsVal: any) => {
            if (actionsVal.methodType === "change") {
              rules[valC].push({
                trigger: "change",
                validator: change(actionsVal),
              });
            } else if (actionsVal.methodType === "blur") {
              rules[valC].push({
                trigger: "blur",
                validator: blur(actionsVal),
              });
            }
          });
        }
      });
    });
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
