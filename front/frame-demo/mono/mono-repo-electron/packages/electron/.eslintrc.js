module.exports = {
  root: true,
  env: {
    node: true,
  },
  globals: {
    $_: "readonly",
    moment: "readonly",
    pageSize: "readonly",
  },
  extends: [
    "plugin:vue/essential",
    "eslint:recommended",
    "@vue/typescript/recommended",
    // '@vue/prettier',
    "@vue/prettier/@typescript-eslint",
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    "@typescript-eslint/camelcase": ["warn"],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-this-alias": ["off"],
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
  },
  // settings: {
  //   "import/resolver": {
  //     node: {
  //       extensions: [".js", ".vue", ".ts", ".d.ts"],
  //     },
  //     alias: {
  //       extensions: [".vue", ".js", ".ts", ".scss", ".d.ts"],
  //       map: [
  //         ["@/src", "./src"],
  //         ["@/components", "./src/components"],
  //         ["@/pages", "./src/pages"],
  //         ["@/router", "./src/router"],
  //         ["@/store", "./src/store"],
  //         ["@/styles", "./src/styles"],
  //         ["@/types", "./src/types"],
  //         ["@/utils", "./src/utils"],
  //       ],
  //     },
  //   },
  // },
};
