# An-Ui - An-Ui

**Pages:** 9

---

## 可编辑表格 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/EditableTable/_demo/

**Contents:**
- 可编辑表格 ​
- 代码演示 ​
  - 基础用法 ​
  - 单行编辑 ​
- API ​
  - EditableTableProps ​
  - EditableTableColumnType ​
  - EditableTableRef ​

可编辑的表格，用于在表格中直接进行数据编辑。在AntdTable和FormPro中的基础上进行封装

可编辑表格的columns属性可同时配置FormItem和AntdTable的属性

dataIndex作为表单项的name使用，且必须唯一；若不传type时，则渲染为普通表格列

继承自AntdTable的columns属性和FormPro的FormFieldConfig属性

**Examples:**

Example 1 (json):
```json
// columns[] 
[
   {
      // 这里是FormFieldConfig和AntdTable.column可接受的props
      title: "名称",
      type: "input",
      dataIndex: "name",
      required: true,
      templateOptions:{
        ...// 这里是表单组件可接受的props，比如InputProps，并在此基础上进行了扩展
      }
  },
]
```

---

## 弹窗表单 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/ModalForm/_demo/

**Contents:**
- 弹窗表单 ​
- 代码演示 ​
  - 基础用法 ​
  - 新增编辑 ​
  - 自定义底部按钮 ​
- API ​
  - ModalForm ​
  - ModalForm.ref ​

适用于需要在弹窗中进行表单录入的场景。 提供了 trigger 来减少 state 的使用（减少因state触发的渲染范围）

完全继承FormPro和antd的Modal的api

---

## 抽屉 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/DrawerPro/_demo/

**Contents:**
- 抽屉 ​
- 代码演示 ​
  - 基础用法 ​
  - 自定义底部按钮 ​
- API ​
  - DrawerPro ​
  - DrawerPro.ref ​

antd的抽屉并不提供底部按钮功能，而DrawerPro在此基础上增加了底部按钮，用法和antd的Modal底部按钮用法一致 提供了 trigger 来减少 state 的使用（减少因state触发的渲染范围）

完全继承AntdDrawer的api，在此基础上进行了以下扩展

---

## 抽屉表单 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/DrawerForm/_demo/

**Contents:**
- 抽屉表单 ​
- 代码演示 ​
  - 基础用法 ​
  - 新增编辑 ​
- API ​
  - DrawerForm.ref ​

适用于需要在弹窗中进行表单录入的场景。 提供了 trigger 来减少 state 的使用（减少因state触发的渲染范围）

完全继承FormPro和DrawerPro的api

---

## 搜索列表 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/FilterList/_demo/

**Contents:**
- 搜索列表 ​
- 代码演示 ​
  - 基础用法 ​
  - 批量操作 ​
- API ​
  - FilterList ​
  - BatchButtonProps ​
  - FilterList.ref ​

适用于需要搜索和列表展示的场景，将搜索表单和表格进行整合，简化开发流程。

批量操作按钮配置，继承自antd ButtonProps，支持以下属性：

---

## 搜索表单 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/FilterForm/_demo/

**Contents:**
- 搜索表单 ​
- 代码演示 ​
- API ​
  - FilterForm ​

适用于需要进行搜索筛选的场景。此组件主要为FilterList使用

完全继承FormPro的api，在此基础上进行了以下扩展

---

## 详情组件 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/DescriptionsPro/_demo/

**Contents:**
- 详情组件 ​
- 代码演示 ​
- API ​
  - DescriptionsProProps ​
  - DescriptionsProItem ​

适用于展示只读的信息。基于antd的 Descriptions组件进行二次封装。

完全继承Descriptions的api，在此基础上进行了以下扩展

---

## 高级表单 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/FormPro/_demo/

**Contents:**
- 高级表单 ​
- 代码演示 ​
  - 基础用法 ​
  - oss上传 ​
  - 表单分组 ​
  - 动态表单 ​
  - 表单联动 ​
  - 远程加载选项 ​
  - 自定义表单项 ​
  - 所有表单项类型 ​

基于AntdForm组件封装，在此基础上提供了以下功能：

通过配置项快速生成表单，减少重复代码。 核心在于表单项的配置FormFieldConfig[]

FormItem主要扩展了4个属性：hide、readOnly、disabled、required，这4个属性支持布尔值和函数（函数主要是为了支持表单联动），函数的参数是当前表单值和额外传给表单项的参数。

templateOptions主要扩展了request属性，支持接口获取options。支持request的组件：Select、Cascader、TreeSelect、Radio、Checkbox

完全继承AntdForm的api，在此基础上进行了以下扩展

完全继承AntdFormItem的api，在此基础上进行了以下扩展

**Examples:**

Example 1 (jsx):
```jsx
// 表单主要是3层结构，对应着表单配置
<Form>
  <Form.Item>
    <Input />
  </Form.Item>
</Form>
```

Example 2 (json):
```json
// FormFieldConfig[] 对应上面的2、3层结构
[
   {
      // 这里是FormItem可接受的props，并在此基础上进行了扩展
      type: "input",
      label: "名称",
      name: "name",
      required: true,
      templateOptions:{
        ...// 这里是表单组件可接受的props，比如InputProps，并在此基础上进行了扩展
      }
  },
]
```

Example 3 (lua):
```lua
...
{
      type: "select",
      name: "name",
      label: "选择框",
      templateOptions: {
        request() {
          return request.post("/api/getOptions");
        },
      },
},
...
```

---

## 高级表格 | 公共组件库

**URL:** https://app-test.17an.com/an-ui/TablePro/_demo/

**Contents:**
- 高级表格 ​
- 代码演示 ​
- API ​
  - TablePro ​
  - TableProColumn ​
  - TablePro.ref ​

基于AntdTable组件封装，在此基础上提供了以下功能：

完全继承AntdTable的api，在此基础上进行了以下扩展

完全继承AntdTableColumn的api，在此基础上进行了以下扩展

---
