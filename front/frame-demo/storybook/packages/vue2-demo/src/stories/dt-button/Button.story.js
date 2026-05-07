import { action } from "@storybook/addon-actions";
import dtButton from "../../components/dt-button/button.vue";

import "semantic-ui-css/semantic.min.css";
console.log(
  document.documentElement.clientWidth,
  "document.documentElement.clientWidth"
);
document.documentElement.style.fontSize =
  document.documentElement.clientWidth / 7.5 + "px";
export default {
  title: "vue2/dt-button",
  component: dtButton,
  argTypes: {
    // name: { control: "text" },
    // className: {
    //   control: {
    //     type: "select",
    //     options: ["primary", "secondary", "positive", "negative"],
    //   },
    // },
    // isLoading: { control: "boolean" },
    // useDiv: { control: "boolean" },
    type: {
      control: "select",
      options: ["primary", "danger", "warning", "hollow", "disabled"],
    },
    size: {
      control: "select",
      options: ["mini", "small", "large"],
    },
  },
};

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { dtButton },
  template: `<dtButton :type="type" :size="size">按钮</dtButton>`,
  methods: {
    action: action("button-clicked"),
  },
});

export const Normal = Template.bind({});
Normal.args = {
  name: "按钮",
  // className: "primary",
};
