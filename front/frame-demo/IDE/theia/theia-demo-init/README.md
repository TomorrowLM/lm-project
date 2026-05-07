## Theia 

- https://zhaomenghuan.js.org/blog/theia-tech-architecture.html

> **Eclipse Theia 不是一个 IDE，而是一个用来开发 IDE 的框架。是Eclipse 基金会打造的云端及桌面IDE框架，该产品旨在替代微软的 Visual Studio Code**

https://www.cnblogs.com/fanqisoft/p/13171657.html

### 下载node-gyp

> node-gyp编译c++

github:https://github.com/nodejs/node-gyp#on-windows

版本选择：https://github.com/nodejs/node-gyp/blob/main/docs/Updating-npm-bundled-node-gyp.md

### 下载pyhon

https://blog.csdn.net/weixin_42289080/article/details/127997003

```
where python
```

```
pyenv version
pyenv install
pyenv global
```

```
npm config set python python2.7
```

### 安装C/C++编译工具

- 安装Visual Studio C++ 相应的编译工具

  ```
  npm config set msbuild_path "D:\software\visual\MSBuild\Current\Bin\MSBuild.exe"
  node-gyp configure --msvs_version=2015
  ```

- 纯前端开发者，只需要安装C/C++编译器工具即可

  ```
  npm install --global --production windows-build-tools
  node-gyp configure --msvs_version=2015
  ```




启动：yarn start 
http://localhost:3000/