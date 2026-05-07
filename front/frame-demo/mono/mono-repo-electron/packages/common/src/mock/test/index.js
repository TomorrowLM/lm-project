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
              description: "?",
              elements: {
                address1: {
                  type: "input",
                  label: "设备地址",
                  defaultValue: "",
                  width: "100%",
                  methods: [
                    {
                      methodType: "blur",
                      rules: [
                        {
                          rule: "^1.?$",
                          ruleType: "reg",
                          ruleMessage: "正则匹配失败",
                        },
                      ],
                    },
                  ],
                },
                address2: {
                  type: "select",
                  label: "波特率",
                  description: "?",
                  defaultValue: "",
                  width: "100%",
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
                      rules: [
                        {
                          rule: "$[address2]===9600",
                          // rule: "formData.address2 === '9600'",
                          ruleType: "bool",
                          actions: [
                            {
                              changeKey: "dataBit",
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
                          ],
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
                  width: "100%",
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
