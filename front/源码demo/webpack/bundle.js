const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser"); //解析成AST语法树
const traverse = require("@babel/traverse").default; //获取依赖
const babel = require("@babel/core"); //ES6的AST转化成ES5

// 获取主入口文件
const getModuleInfo = (file) => {
  /**
  第一步:实现获取主模块内容
  */
  const body = fs.readFileSync(file, "utf-8");
  // console.log('body', body);

  /**
   第二步:将获取到的模块内容 解析成AST语法树，这个需要用到一个依赖包@babel/parser
  parse这个API。它的主要作用是 parses the provided code as an entire ECMAScript program，也就是将我们提供的代码解析成完整的ECMAScript代码的AST。
  */
  const ast = parser.parse(body, {
    sourceType: "module", //表示我们要解析的是ES模块
  });
  // console.log("ast", ast);
  //当前我们解析出来的不单单是index.js文件里的内容，它也包括了文件的其他信息。 而它的内容其实是它的属性program里的body里
  // console.log("ast.program.body", ast.program.body);

  /**
   *   第三步:需要遍历AST，将用到的依赖收集起来。就是将用import语句引入的文件路径收集起来。我们将收集起来的路径放到deps里。
   */
  const deps = {};
  traverse(ast, {
    //ImportDeclaration方法代表的是对ast中type类型为ImportDeclaration的节点的处理。
    ImportDeclaration({ node }) {
      const dirname = path.dirname(file);
      // console.log("dirname", dirname); //dirname ./src
      // console.log('node.source.value',node.source.value);//node.source.value ./add.js
      const abspath = "./" + path.join(dirname, node.source.value); //这里的value指的是什么意思呢？其实就是import的值
      deps[node.source.value] = abspath;
    },
  });
  // console.log("getModuleInfo:deps", deps); //{ './add.js': './src\\add.js', './minus.js': './src\\minus.js' }

  /**
   * 第四步:把获得的ES6的AST转化成commonjs，import -> require.依赖包 @babel/core @babel/preset-env
   */
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });
  // console.log("code", code);

  // 新增代码
  const moduleInfo = { file, deps, code }; //模块的路径（file），该模块的依赖（deps），该模块转化成es5的代码
  // console.log("moduleInfo", moduleInfo);
  return moduleInfo;
};
// getModuleInfo("./src/index.js");

/**
 *递归获取所有文件依赖,讲解下parseModules方法：
  我们首先传入主模块路径
  将获得的模块信息放到temp数组里。
  外面的循坏遍历temp数组，此时的temp数组只有主模块
  循环里面再获得主模块的依赖deps
  遍历deps，通过调用getModuleInfo将获得的依赖模块信息push到temp数组里。
*/
const parseModules = (file) => {
  const entry = getModuleInfo(file);
  const temp = [entry]; //扁平化数组，存放所有模块信息
  // console.log('temp', temp);
  const depsGraph = {}; //新增代码
  for (let i = 0; i < temp.length; i++) {
    const deps = temp[i].deps;
    // console.log("parseModules:deps", deps);
    if (deps) {
      for (const key in deps) {
        if (deps.hasOwnProperty(key)) {
          temp.push(getModuleInfo(deps[key]));
        }
      }
    }
  }
  // 文件名作为属性名。包含deps和code子属性
  temp.forEach((moduleInfo) => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code,
    };
  });
  return depsGraph;
};
const depsGraph = parseModules("./src/index.js");
// console.log("depsGraph", depsGraph);

//浏览器不会识别执行require和exports
const bundle = (file) => {
  const depsGraph = JSON.stringify(parseModules(file)); //返回一个整合完整的字符串代码
  /**
  * 把保存下来的depsGraph，传入一个立即执行函数。
   将主模块路径传入require函数执行
   执行reuire函数的时候，立即执行一个立即执行函数
   执行eval（code）,也就是执行主模块的code这段代码，这段代码会读取require, exports传参
  */
  return `(function (graph) {
    function require(file) {
      //相对路径转化成绝对路径
      function absRequire(relPath) {
        return require(graph[file].deps[relPath])
      }
      //执行add.js的code时候，会遇到exports这个还没定义的问题.因此我们可以自己定义一个exports对象。
      var exports = {};
      (function (require, exports, code) {
        //code代码执行过程中会执行到require函数。
        //这时会调用这个require，也就是我们传入的absRequire
        eval(code);
      })(absRequire, exports, graph[file].code)
      console.log('exports', exports);
      return exports;
    }
    require('${file}')
  })(${depsGraph})`;
};
// const content = bundle("./src/index.js");
// console.log("content", content);

//写入到我们的dist目录下
// fs.mkdirSync("./dist");
// fs.writeFileSync("./dist/bundle.js", content);
