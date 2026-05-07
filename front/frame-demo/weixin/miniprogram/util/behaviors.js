// my-behavior.js

module.exports = Behavior({
  behaviors: [],
  //使用组件时，出过来的props
  properties: {
    myBehaviorProperty: {
      type: String
    }
  },
  data: {
    sharedText: 'This is a piece of data shared between pages.'
  },
  created: function () {
    console.log('[my-behavior] created')
  },
  attached: function () {
    console.log('[my-behavior] attached')
  },
  ready: function () {
    console.log('[my-behavior] ready')
  },

  methods: {
    myBehaviorMethod: function () {
      console.log('[my-behavior] log by myBehaviorMehtod')
    },
  }
})