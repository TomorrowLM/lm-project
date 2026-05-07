import Vue from 'vue'
import App from './App'
import VueResource from 'vue-resource'
import store from './store'
// import 'lib-flexible/flexible'
Vue.config.productionTip = false
Vue.use(VueResource)  
App.mpType = 'app'
const app = new Vue({
  ...App,
  store,
})

app.$mount()
 