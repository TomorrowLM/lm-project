// index.js
const app = getApp();
var myBehavior = require('../../util/behaviors')
Page({
  behaviors: [myBehavior],
  data: {
    
  },
  onLoad: function() {
    console.log(this.data.sharedText === 'This is a piece of data shared between pages.');
  },
  onShow() {

  },
  onHide() {
  },
})