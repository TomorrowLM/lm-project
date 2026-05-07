<template>
  <div class="dt-button">
    <button
      :disabled="disabled || loading"
      :class="classes"
      :style="{backgroundColor: bgcolor, color: color}"
      :type="actionType"
    >
      <span class="dt-btn-loading" v-if="loading">
        <span
          class="dt-btn-rolling"
          :class="rollingClasses"
          :style="{marginRight: loadingTxt ? '8px' : '0'}"
        >
          <i></i>
        </span>
        <template v-if="size === 'large'">{{loadingTxt}}</template>
      </span>
      <span :style="{visibility: loading ? 'hidden' : ''}">
        <slot></slot>
      </span>
    </button>
  </div>
</template>

<script type="text/babel">
import { isColor } from "../utils";

export default {
  name: "dt-button",
  props: {
    disabled: Boolean,
    actionType: {
      validator(value) {
        return ["button", "submit", "reset"].indexOf(value) > -1;
      },
      default: "button"
    },
    type: {
      validator(value) {
        return (
          ["primary", "danger", "warning", "hollow", "disabled"].indexOf(
            value
          ) > -1
        );
      },
      default: "primary"
    },
    size: {
      validator(value) {
        return ["mini", "small", "large"].indexOf(value) > -1;
      }
    },
    bgcolor: {
      validator(value) {
        if (!value) return true;
        return isColor(value);
      }
    },
    color: {
      validator(value) {
        if (!value) return true;
        return isColor(value);
      }
    },
    shape: {
      validator(value) {
        return ["square", "circle", "angle"].indexOf(value) > -1;
      },
      default: "square"
    },
    loading: {
      type: Boolean,
      default: false
    },
    loadingColor: {
      validator(value) {
        if (!value) return true;
        return isColor(value);
      },
      default: "#FFF"
    },
    loadingTxt: String
  },
  computed: {
    rollingClasses() {
      let a = "";
      if (this.size === "mini") {
        a = "dt-btn-rolling-mini";
      } else if (!this.size || this.size === "small") {
        a = "dt-btn-rolling-small";
      } else {
        a = "dt-btn-rolling-large";
      }

      return a;
    },
    classes() {
      let s = "";
      if (this.size === "mini") {
        s = "dt-btn-mini";
      } else {
        s = this.size === "large" ? "dt-btn-block" : "dt-btn";
      }

      let t = " dt-btn-" + this.type;

      if (this.bgcolor) {
        t = "";
      }

      if (this.disabled) {
        t = " dt-btn-disabled";
      }

      let r = "";
      if (this.shape === "angle") {
        r = " dt-btn-angle";
      } else {
        r = this.shape === "circle" ? " dt-btn-circle" : "";
      }

      return s + t + r;
    }
  }
};
</script>

<style lang="scss" scoped>
@import "./button.scss";
</style>
