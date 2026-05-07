import { rmSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import pkg from "../vue/package.json";
import path from "path";
function _resolve(dir: string) {
  return path.resolve(__dirname, dir);
}
// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 移除之前编译过的 electron，防止代码冲突
  // rmSync("dist/dist-electron", { recursive: true });
  // 根据当前工作目录中的 `mode` 加载 .env 文件
  // 设置第三个参数为 '' 来加载所有环境变量，而不管是否有 `VITE_` 前缀。
  const env = loadEnv(mode, process.cwd(), "");
  const isServe = command === "serve";
  const isBuild = command === "build";
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  return {
    build: {
      target: "es2015", // 浏览器兼容性
      cssTarget: "chrome79", // 此选项允许用户为 CSS 的压缩设置一个不同的浏览器 target
      chunkSizeWarningLimit: 2000, // chunk 大小警告的限制（以 kbs 为单位）。
      outDir: "dist/dist-render", // 指定输出路径
      assetsDir: "static", // 指定生成静态资源的存放路径（相对于 build.outDir）。
      manifest: false, // 当设置为 true，构建后将会生成 manifest.json 文件，包含了没有被 hash 的资源文件名和 hash 后版本的映射。可以为一些服务器框架渲染时提供正确的资源引入链接。
      rollupOptions: {
        // external: ["vue", "element-plus", "@vswift/common"], // 很重要，定义打包时被排除的包，避免整个包被打包进来
        output: {
          globals: {
            vue: "Vue", // 外部包别名，在 dist/index.umd.cjs 中会使用到
            "element-plus": "ElementPlus", // 外部包别名
          },
        },
      },
    },
    server:
      process.env.VSCODE_DEBUG &&
      (() => {
        const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
        return {
          host: url.hostname,
          port: +url.port,
          open: true,
        };
      })(),
    clearScreen: false,
    resolve: {
      alias: {
        "@": _resolve("src"),
        "@/common": _resolve("./commone/src"),
      },
    },
    // define: {
    //   $_: JSON.stringify("lodash"),
    // },
    plugins: [vue(), renderer()],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@packages/common/style/theme-var.scss";`, //注入全局样式
        },
      },
    },
  };
});
