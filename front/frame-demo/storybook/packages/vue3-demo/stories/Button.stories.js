import { storiesOf } from '@storybook/vue3';
import { action } from '@storybook/addon-actions';

storiesOf('Vue3/Button', module)
  .add('Element Plus 按钮', () => ({
    template: '<el-button type="primary">主要按钮</el-button>'
  })); 