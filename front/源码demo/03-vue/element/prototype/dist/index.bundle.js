var MyButton = {
  name: "MyButton",
  data: function () {
    return {
      count: 0
    };
  },
  template: '<button v-on:click="count++">click me {{count}} </button>'
};

MyButton.install = app => app.component("MyButton", MyButton); //组件库


const Element = {
  MyButton,
  install: app => {
    app.use(MyButton);
  }
};

export { Element as default };
