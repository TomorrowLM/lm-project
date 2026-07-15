const path = require('path');
const fs = require('fs');
const { log } = require('console');
const filePath = path.join(__dirname, '../routes'); // 替换为你的文件目录
console.log('files',fs.readdirSync(filePath));

const getFiles = dir =>
  fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getFiles(name)] : [...files, name];
  }, []);

const importAll = (filePath) => {
  const files = getFiles(filePath);
  const modules = {
    'common': [],
    'vue-mobile':[],
    'white':[]
  };
  for (const file of files) {
    if (file.endsWith('.js')) {
      Object.keys(modules).forEach(val => {
        if (file.includes(val)) {
          modules[val].push({
            path: `/${val}/${path.basename(file, '.js')}`,
            importVal: require(file)
          })
        }
      })
    }
  }
  return modules;
};

const routes = importAll(filePath)
console.log('routes:',routes);
const commonRoutes = routes.common.map(val=>val.path)
const whiteRoutes = routes.white.map(val=>val.path)
const whitePaths = routes.white.map(val=>val.path)
console.log(whitePaths);

module.exports = {
  routes,
  whitePaths
}
