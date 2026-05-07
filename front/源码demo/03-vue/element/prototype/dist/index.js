var Element = (function (vue) {
  'use strict';

  var MyButton = {
    name: "MyButton",
    data: function () {
      return {
        count: 0
      };
    },
    template: '<button v-on:click="count++">click me {{count}} </button>'
  };

  var script = {
      
  };

  function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (vue.openBlock(), vue.createBlock("button", null, "vue"))
  }

  script.render = render;
  script.__file = "src/SfcButton.vue";

  MyButton.install = app => app.component("MyButton", MyButton);

  script.install = app => app.component("SfcButton", script); //组件库


  const Element = {
    MyButton,
    SfcButton: script,
    install: app => {
      app.use(MyButton);
      app.use(script);
    }
  };

  return Element;

}(Vue));
