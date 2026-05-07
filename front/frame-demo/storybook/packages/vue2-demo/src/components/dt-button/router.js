export const name = {
  path: '/dt-button',
  name: 'dt-button',
  component: r => require.ensure([], () => r(require('./demo.vue')), 'dt-button'),
  meta: {
    requireAuth: false,
    title: ''
  }
}