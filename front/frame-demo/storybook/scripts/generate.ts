import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@vue/compiler-sfc';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

interface ComponentInfo {
  name: string;
  description: string;
  props: Array<{
    name: string;
    type: string;
    required: boolean;
    default: any;
    description: string;
  }>;
  events: Array<{
    name: string;
    description: string;
  }>;
  slots: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * 解析Vue组件文件
 * @param filePath 文件路径
 */
function parseVueComponent(filePath: string): ComponentInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { descriptor } = parse(content);
  
  const componentInfo: ComponentInfo = {
    name: path.basename(filePath, '.vue'),
    description: '',
    props: [],
    events: [],
    slots: []
  };

  // 解析script部分
  if (descriptor.script) {
    const scriptContent = descriptor.script.content;
    const ast = parser.parse(scriptContent, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx']
    });

    traverse(ast, {
      ObjectProperty(path) {
        if (path.node.key.name === 'props') {
          // 解析props
          const props = path.node.value.properties;
          props.forEach((prop: any) => {
            componentInfo.props.push({
              name: prop.key.name,
              type: prop.value.properties.find((p: any) => p.key.name === 'type')?.value.name || 'any',
              required: prop.value.properties.find((p: any) => p.key.name === 'required')?.value.value || false,
              default: prop.value.properties.find((p: any) => p.key.name === 'default')?.value.value,
              description: ''
            });
          });
        }
      }
    });
  }

  // 解析template部分
  if (descriptor.template) {
    const templateContent = descriptor.template.content;
    // 解析事件和插槽
    // TODO: 实现事件和插槽的解析
  }

  return componentInfo;
}

/**
 * 解析React组件文件
 * @param filePath 文件路径
 */
function parseReactComponent(filePath: string): ComponentInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });

  const componentInfo: ComponentInfo = {
    name: path.basename(filePath, '.tsx'),
    description: '',
    props: [],
    events: [],
    slots: []
  };

  traverse(ast, {
    // TODO: 实现React组件的解析
  });

  return componentInfo;
}

/**
 * 生成Storybook故事文件
 * @param componentInfo 组件信息
 */
function generateStory(componentInfo: ComponentInfo): string {
  const isVue = componentInfo.name.endsWith('.vue');
  const componentName = componentInfo.name.replace(/\.(vue|tsx)$/, '');

  if (isVue) {
    return `import { Meta, Story } from '@storybook/vue3';
import ${componentName} from '../package/components/${componentName}/${componentName}.vue';

export default {
  title: 'Components/${componentName}',
  component: ${componentName},
  argTypes: {
    ${componentInfo.props.map(prop => `
    ${prop.name}: {
      control: '${prop.type === 'boolean' ? 'boolean' : 'text'}',
      description: '${prop.description}',
      table: {
        type: { summary: '${prop.type}' },
        defaultValue: { summary: ${prop.default || 'undefined'} },
      },
    }`).join(',')}
  },
} as Meta;

const Template: Story = (args) => ({
  components: { ${componentName} },
  setup() {
    return { args };
  },
  template: '<${componentName} v-bind="args" />',
});

export const Default = Template.bind({});
Default.args = {
  ${componentInfo.props.map(prop => `${prop.name}: ${prop.default || 'undefined'}`).join(',\n  ')}
};
`;
  } else {
    return `import { Meta, Story } from '@storybook/react';
import ${componentName} from '../package/components/${componentName}/${componentName}';

export default {
  title: 'Components/${componentName}',
  component: ${componentName},
  argTypes: {
    ${componentInfo.props.map(prop => `
    ${prop.name}: {
      control: '${prop.type === 'boolean' ? 'boolean' : 'text'}',
      description: '${prop.description}',
      table: {
        type: { summary: '${prop.type}' },
        defaultValue: { summary: ${prop.default || 'undefined'} },
      },
    }`).join(',')}
  },
} as Meta;

const Template: Story = (args) => <${componentName} {...args} />;

export const Default = Template.bind({});
Default.args = {
  ${componentInfo.props.map(prop => `${prop.name}: ${prop.default || 'undefined'}`).join(',\n  ')}
};
`;
  }
}

/**
 * 主函数
 */
async function main() {
  const componentsDir = path.resolve(__dirname, '../package/components');
  const storiesDir = path.resolve(__dirname, '../stories');

  // 确保stories目录存在
  if (!fs.existsSync(storiesDir)) {
    fs.mkdirSync(storiesDir, { recursive: true });
  }

  // 遍历组件目录
  const files = fs.readdirSync(componentsDir);
  
  for (const file of files) {
    const filePath = path.join(componentsDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // 处理组件目录
      const componentFiles = fs.readdirSync(filePath);
      
      for (const componentFile of componentFiles) {
        const componentPath = path.join(filePath, componentFile);
        let componentInfo: ComponentInfo;

        if (componentFile.endsWith('.vue')) {
          componentInfo = parseVueComponent(componentPath);
        } else if (componentFile.endsWith('.tsx')) {
          componentInfo = parseReactComponent(componentPath);
        } else {
          continue;
        }

        // 生成故事文件
        const story = generateStory(componentInfo);
        const storyPath = path.join(storiesDir, `${componentInfo.name}.stories.${componentFile.endsWith('.vue') ? 'vue' : 'tsx'}`);
        fs.writeFileSync(storyPath, story);
      }
    }
  }
}

main().catch(console.error); 