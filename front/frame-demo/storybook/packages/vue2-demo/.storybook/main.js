// const path = require("path");
// const VueLoaderPlugin = require("vue-loader/lib/plugin");
// const Vue = require("vue");

// // 注册全局组件
// Vue.component("el-button", {
//   template: '<button class="el-button"><slot></slot></button>',
// });

// module.exports = {
//   stories: [
//     "../stories/**/*.stories.mdx",
//     "../stories/**/*.stories.@(js|jsx|ts|tsx|vue)",
//   ],
//   addons: [
//     "@storybook/addon-links",
//     "@storybook/addon-essentials",
//     "@storybook/addon-interactions",
//   ],
//   framework: {
//     name: "@storybook/vue-webpack5",
//     options: {}
//   },
//   docs: {
//     autodocs: true
//   },
//   webpackFinal: async (config) => {
//     config.plugins.push(new VueLoaderPlugin());

//     // 添加 babel-loader 配置
//     config.module.rules.push({
//       test: /\.(js|jsx|ts|tsx)$/,
//       exclude: /node_modules/,
//       use: {
//         loader: "babel-loader",
//         options: {
//           presets: ["@babel/preset-env", "@babel/preset-typescript"],
//           plugins: [
//             "@babel/plugin-transform-runtime",
//             "@babel/plugin-proposal-class-properties",
//           ],
//         },
//       },
//     });

//     /** removes existing scss rule */
//     config.module.rules = config.module.rules.filter(
//       (rule) => !rule.test.test(".scss")
//     );
//     config.module.rules.push(
//       {
//         test: /\.scss$/,
//         use: [
//           "vue-style-loader",
//           {
//             loader: "css-loader",
//             options: {
//               sourceMap: true,
//               importLoaders: 2
//             }
//           },
//           {
//             loader: "postcss-loader",
//             options: {
//               sourceMap: true,
//               postcssOptions: {
//                 plugins: [
//                   require('autoprefixer')
//                 ]
//               }
//             }
//           },
//           {
//             loader: "sass-loader",
//             options: {
//               sourceMap: true,
//               implementation: require("sass"),
//               sassOptions: {
//                 indentedSyntax: false,
//                 outputStyle: 'expanded'
//               }
//             }
//           },
//         ],
//       }
//     );

//     // 添加对图片等资源的支持
//     config.module.rules.push({
//       test: /\.(png|jpe?g|gif|svg|webp)$/i,
//       type: "asset/resource",
//     });

//     // 配置别名
//     config.resolve.alias = {
//       ...config.resolve.alias,
//       "@": path.resolve(__dirname, "../src"),
//       vue$: "vue/dist/vue.esm.js",
//     };

//     // 添加 Vue 2 的解析配置
//     config.resolve.extensions = [".js", ".vue", ".json", ".ts", ".tsx"];

//     return config;
//   },
// };

module.exports = {
  stories: ["../src/stories/**/*.story.@(js|mdx)"],
  logLevel: "debug",
  // framework: {
  //   name: "@storybook/vue-webpack5",
  //   options: {},
  // },
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-controls",
    "@storybook/addon-storysource",
    "@storybook/addon-actions",
    "@storybook/addon-interactions",
    "@storybook/addon-links",
    "@storybook/addon-viewport",
    "@storybook/addon-backgrounds",
    "@storybook/addon-a11y",
  ],
  core: {
    builder: "webpack4",
  },
  staticDirs: ["../public"],
  webpackFinal: async (config) => {
    config.module.rules.push({
      test: /\.scss$/,
      use: ["vue-style-loader", "css-loader", "sass-loader"],
    });
    return config;
  },
};
