// export default [
//   {
//     url: "/getData", // 注意，这里只能是string格式
//     method: "GET",
//     data: () => {
//       return {
//         "list|5-10": [
//           {
//             name: "@cname",
//             url: "choose1.png",
//             sportsman: "足球运动员",
//             age: "29",
//           },
//         ],
//       };
//     },
//   },
// ];
export default [
  {
    url: "getData", //匹配到指定url
    method: "get", //请求类型
    response: () => {
      return {
        code: 0,
        message: "ok",
        data: {
          name: "串口",
          key: "com",
          panels: [
            {
              title: "链路配置",
              elements: {
                address1: {
                  type: "input",
                  label: "设备地址",
                  key: "address1",
                  defaultValue: "12",
                  width: "100%",
                  methods: [
                    {
                      methodType: "blur",
                      actions: [
                        {
                          actionType: "reg",
                          rule: "^1.?$",
                          ruleMessage: "正则匹配失败",
                        },
                      ],
                    },
                  ],
                },
                address2: {
                  type: "select",
                  label: "波特率",
                  key: "address2",
                  defaultValue: "",
                  width: "50%",
                  options: [
                    {
                      key: "9600",
                      value: "9600",
                    },
                    {
                      key: "4800",
                      value: "4800",
                    },
                  ],
                  methods: [
                    {
                      methodType: "change",
                      actions: [
                        {
                          rule: "formData.address2 === '9600'",
                          actionType: "changeOptions",
                          changeKey: "formList['value']['panels'][0]['elements']['dataBit']",
                          options: [
                            {
                              key: "5",
                              value: "5",
                            },
                            {
                              key: "6",
                              value: "6",
                            },
                          ],
                        },
                        {
                          rule: "formData.address2 === '4800'",
                          actionType: "changeFormData",
                          changeKey: "address1",
                          changeVal: 1,
                        },
                      ],
                    },
                  ],
                },
                dataBit: {
                  type: "select",
                  label: "数据位",
                  key: "dataBit",
                  defaultValue: "",
                  width: "50%",
                  options: [
                    {
                      key: "7",
                      value: "7",
                    },
                    {
                      key: "8",
                      value: "8",
                    },
                  ],
                },
              },
            },
          ],
        },
      };
    },
  },
];
