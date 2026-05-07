import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import axios from "axios";
import { $useEnv } from "./global-util";

//请求配置
interface CustomRequestConfig extends AxiosRequestConfig {
  baseURL?: string; // `baseURL` 将自动加在 `url` 前面，除非 `url` 是一个绝对 URL。
  url: string;
  // method: Method;
  // headers?: RequestHeaderProps; //自定义请求头
  params?: any; //与请求一起发送的 URL 参数,适用于这些请求方法 'GET'
  data?: any; //作为请求主体被发送的数据,适用于这些请求方法 'PUT', 'POST'
  timeout?: number; //请求超过 `timeout` 的时间，请求将被中断
  responseType?: any; // 表示服务器响应的数据类型，可以是 'arraybuffer', 'blob', 'document', 'json', 'text', 'stream'
  cancelExecutor?: boolean; //是否短时间重复请求
}

const { VITE_BASE_API } = $useEnv();
console.log(VITE_BASE_API);
// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: "", // api base_url
  timeout: 6000, // 请求超时时间
});

const err = (error: any) => {
  console.log(error);
  if (error.response) {
    const data = error.response.data;
    if (error.response.status === 403) {
      // Message.error("Forbidden");
    }
    if (error.response.status === 401) {
      // Message.error("token失效");
      window.localStorage.removeItem("token");
    }
  } else {
    // 请求超时状态
    if (error.message.includes("timeout")) {
      // Message.error("请求超时，请检查网络是否连接正常");
    } else {
      // 可以展示断网组件
      // Message.error("请求失败，请检查网络是否已连接");
    }
  }
  return Promise.reject(error);
};

// 请求拦截
instance.interceptors.request.use((config) => {
  // 这里可以设置token: config!.headers!.Authorization = token
  return config;
}, err);

// 响应拦截
instance.interceptors.response.use(async (response) => {
  // console.log(response);
  if (response.status !== 200) {
    return Promise.reject(response.data);
  }
  return Promise.resolve(response.data);
}, err);

const request: any = {
  get: (config: any) => {
    return instance.get(config.url, config);
  },
  post: (config: any) => {
    return instance.post("post", config);
  },
  all: (config: any) => {
    const { url } = config;
    return instance.post(url, { method: "post", ...config });
  },
  // interval: (config: any) => {
  //   return instance.post(url, { method: method, ...config });
  // },
};

export default request;
