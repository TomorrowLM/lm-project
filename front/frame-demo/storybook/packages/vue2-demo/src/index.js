import Vue from 'vue';
import App from './App.vue';

// eslint-disable-next-line
new Vue({
  el: '#app',
  render: h => h(App),
});
console.log(document.documentElement.clientWidth,'document.documentElement.clientWidth');
document.documentElement.style.fontSize = document.documentElement.clientWidth / 7.5 + 'px';