import request from "../util/axios";

export const getData = () => request.get({ url: "getData" });
