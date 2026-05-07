import { app } from "@/main";

//读取env配置
export const $useEnv = () => {
  const { VITE_APP_TITLE, VITE_BASE_API, VITE_PUBLIC_PATH, MODE } = (
    import.meta as any
  ).env;
  // 如果名字变换了，我们可以在这里解构别名

  return {
    MODE,
    VITE_BASE_API,
    VITE_PUBLIC_PATH,
  };
};
