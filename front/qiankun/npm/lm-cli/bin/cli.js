#!/usr/bin/env node
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const vue2Deps = require('./dependencies/vue2')
const vue2ClassComponent = require('./dependencies/vue2-class-component')
console.log(vue2ClassComponent.dependencies.core,11)
const frameworks = {
  vue2: vue2Deps,
  vue2ClassComponent: vue2ClassComponent,
  react: {
    description: 'React - 用于构建用户界面的 JavaScript 库',
    dependencies: {
      core: [{ name: 'react', version: '^18.0.0' }, { name: 'react-dom', version: '^18.0.0' }],
      router: [{ name: 'react-router-dom', version: '^6.0.0' }],
      state: [{ name: 'redux', version: '^4.0.0' }, { name: 'react-redux', version: '^8.0.0' }],
      ui: [{ name: 'antd', version: '^4.0.0' }, { name: '@mui/material', version: '^5.0.0' }],
      utils: [{ name: 'axios', version: '^0.27.2' }, { name: 'dayjs', version: '^1.11.0' }]
    },
    devDependencies: {
      build: [{ name: 'vite', version: '^3.0.0' }, { name: '@vitejs/plugin-react', version: '^2.0.0' }],
      types: [{ name: '@types/react', version: '^18.0.0' }, { name: '@types/node', version: '^17.0.0' }],
      plugins: [{ name: '@types/react-dom', version: '^18.0.0' }]
    }
  },
  angular: {
    description: 'Angular - 平台和框架，用于构建客户端应用程序',
    dependencies: {
      core: [{ name: '@angular/core', version: '^15.0.0' }, { name: '@angular/common', version: '^15.0.0' }],
      router: [{ name: '@angular/router', version: '^15.0.0' }],
      state: [{ name: '@ngrx/store', version: '^15.0.0' }],
      ui: [{ name: '@angular/material', version: '^15.0.0' }],
      utils: [{ name: 'rxjs', version: '^7.0.0' }, { name: 'axios', version: '^0.27.2' }]
    },
    devDependencies: {
      build: [{ name: '@angular/cli', version: '^15.0.0' }, { name: '@angular/compiler', version: '^15.0.0' }],
      types: [{ name: '@types/node', version: '^17.0.0' }],
      plugins: [{ name: '@angular-devkit/build-angular', version: '^15.0.0' }]
    }
  }
};

function installPackages(packages, isDev = false) {
  if (!packages.length) return;
  const command = isDev ? 'pnpm install --save-dev' : 'pnpm install';
  const spinner = ora(`Installing packages: ${packages.join(', ')}...`).start();

  try {
    execSync(`${command} ${packages.join(' ')}`, { stdio: 'inherit' });
    spinner.succeed('Packages installed successfully!');
  } catch (error) {
    spinner.fail('Failed to install packages');
    console.error(chalk.red(error));
    process.exit(1);
  }
}

// 从package copy.json获取依赖版本参考
function getPackageVersions() {
  const packageCopyPath = path.join(process.cwd(), 'packages/vue-demo-pc/package copy.json');
  try {
    const packageContent = JSON.parse(fs.readFileSync(packageCopyPath, 'utf8'));
    return {
      dependencies: packageContent.dependencies || {},
      devDependencies: packageContent.devDependencies || {}
    };
  } catch (error) {
    console.error(chalk.red(`读取package copy.json失败: ${error.message}`));
    return { dependencies: {}, devDependencies: {} };
  }
}

async function promptFramework() {
  const choices = Object.entries(frameworks).map(([key, value]) => ({
    name: `${key.charAt(0).toUpperCase() + key.slice(1)} - ${value.description}`,
    value: key
  }));

  const { framework } = await inquirer.prompt([
    {
      type: 'list',
      name: 'framework',
      message: '请选择要使用的框架：',
      choices
    }
  ]);

  return framework;
}

async function promptDependencies(framework) {
  const frameworkConfig = frameworks[framework];
  // 将dependencyCategories定义为全局变量
  global.dependencyCategories = [
    {
      name: '核心依赖',
      key: 'core',
      type: 'dependencies'
    },
    {
      name: '路由',
      key: 'router',
      type: 'dependencies'
    },
    {
      name: '状态管理',
      key: 'state',
      type: 'dependencies'
    },
    {
      name: 'UI组件库',
      key: 'ui',
      type: 'dependencies'
    },
    {
      name: '工具库',
      key: 'utils',
      type: 'dependencies'
    },
    {
      name: '构建工具',
      key: 'build',
      type: 'devDependencies'
    },
    {
      name: '类型定义',
      key: 'types',
      type: 'devDependencies'
    },
    {
      name: '插件',
      key: 'plugins',
      type: 'devDependencies'
    }
  ];

  const questions = dependencyCategories.map(category => {
    const deps = frameworkConfig[category.type][category.key] || [];
    // 将对象数组转换为选择项格式
    const choices = deps.map(dep => {
      if (typeof dep === 'string') {
        return { name: dep, value: dep };
      } else {
        return { name: `${dep.name}@${dep.version}`, value: dep.name };
      }
    });

    return {
      type: 'checkbox',
      name: category.key,
      message: `选择${category.name}：`,
      choices
    };
  });

  const answers = await inquirer.prompt(questions);
  return answers;
}

async function main() {
  console.log(chalk.blue.bold('\n LM Web CLI - 框架依赖安装工具 \n'));

  try {
    const framework = await promptFramework();
    const selectedDependencies = await promptDependencies(framework);
    console.log(selectedDependencies, 'selectedDependencies');
    const normalDeps = [];
    const devDeps = [];

    Object.entries(selectedDependencies).forEach(([key, packages]) => {
      const category = global.dependencyCategories.find(cat => cat.key === key);
      if (category) {
        if (category.type === 'devDependencies') {
          devDeps.push(...packages);
        } else {
          normalDeps.push(...packages);
        }
      }
    });
    console.log(normalDeps, devDeps, 'normalDeps');

    // 获取frameworks配置中的版本信息
    const frameworkConfig = frameworks[framework];
    const allDeps = { ...frameworkConfig.dependencies, ...frameworkConfig.devDependencies };

    // 构建带版本的依赖数组
    const normalDepsWithVersion = [];
    const devDepsWithVersion = [];

    // 处理普通依赖
    normalDeps.forEach(depName => {
      Object.entries(allDeps).forEach(([category, deps]) => {
        deps.forEach(dep => {
          const name = typeof dep === 'string' ? dep : dep.name;
          if (name === depName && global.dependencyCategories.find(cat => cat.key === category && cat.type === 'dependencies')) {
            if (typeof dep === 'object' && dep.version) {
              normalDepsWithVersion.push(`${name}@${dep.version}`);
            } else {
              normalDepsWithVersion.push(name);
            }
          }
        });
      });
    });

    // 处理开发依赖
    devDeps.forEach(depName => {
      Object.entries(allDeps).forEach(([category, deps]) => {
        deps.forEach(dep => {
          const name = typeof dep === 'string' ? dep : dep.name;
          if (name === depName && global.dependencyCategories.find(cat => cat.key === category && cat.type === 'devDependencies')) {
            if (typeof dep === 'object' && dep.version) {
              devDepsWithVersion.push(`${name}@${dep.version}`);
            } else {
              devDepsWithVersion.push(name);
            }
          }
        });
      });
    });

    if (normalDepsWithVersion.length > 0) {
      await installPackages(normalDepsWithVersion);
    }
    if (devDepsWithVersion.length > 0) {
      await installPackages(devDepsWithVersion, true);
    }

    console.log(chalk.green('\n 安装完成！\n'));
  } catch (error) {
    console.error(chalk.red('\n 安装过程中出现错误：\n'), error);
    process.exit(1);
  }
}

main();
