// rollup.config.js
// const vuePlugin = require("../../rollup-plugin-vue/index");
import babel from "@rollup/plugin-babel";
import vuePlugin from "rollup-plugin-vue";
/*
  amd – 异步模块定义，⽤于像 RequireJS 这样的模块加载器
  cjs – CommonJS，适⽤于 Node 和 Browserify/Webpack
  es – 将软件包保存为 ES 模块⽂件
  iife – ⼀个⾃动执⾏的功能，适合作为 <script> 标签。（如果要为应⽤程序创建⼀个捆绑包，您可
  能想要使⽤它，因为它会使⽂件⼤⼩变⼩。）
*/
const es = {
  input: "src/entry.js",
  output: {
    file: "dist/index.bundle.js",
    name: "Element",
    format: "es",
    globals: {
      vue: "Vue",
    },
  },
  external: ["vue"],
  plugins: [
    babel(),
    vuePlugin({
      css: true,
    }),
  ],
};
const iife = {
  input: "src/entry.js",
  output: {
    file: "dist/index.js",
    name: "Element",
    format: "iife",
    globals: {
      vue: "Vue",
    },
  },
  external: ["vue"],
  plugins: [
    babel(),
    vuePlugin({
      css: true,
    }),
  ],
};
import { terser } from "rollup-plugin-terser";
const minEs = {
  input: "src/entry.js",
  external: ["vue"],
  output: {
    file: "dist/index.min.js",
    name: "Element",
    format: "umd",
  },
  plugins: [
    babel(),
    vuePlugin({
      css: true,
    }),
    terser(),
  ],
};
const cjs = {
  input: "src/entry.js",
  external: ["vue"],
  output: {
    file: "dist/index.cjs.js",
    name: "Element",
    format: "cjs",
  },
  plugins: [
    babel(),
    vuePlugin({
      css: true,
    }),
  ],
};
export default [es, iife, minEs, cjs];
