import { keywords } from '@/constants/code-mirror';
import * as monaco from 'monaco-editor';
import type { IDisposable } from 'monaco-editor';
import * as monacoWorker from 'monaco-editor/esm/vs/editor/editor.worker.js';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
// import initialize from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import type { MonacoEditorProps, ConfigProps } from './index.d';
import { language as sqlLanguage } from 'monaco-editor/esm/vs/basic-languages/sql/sql.js';
import { format } from 'sql-formatter'
// import { WorkerManager } from './aviatorscript/worker';
import aviSuggestions from './aviatorscript/suggestions.js';
import aviMonarchs from './aviatorscript/monarch';
// import { registerWorker } from 'monaco-editor';
import { WorkerManager } from './language-service/worker';
import DiagnosticsAdapter from './language-service/DiagnosticsAdapter';
import TodoLangWorker from './language-service/todoLangWorker.ts?worker';
import { reactive } from 'vue';

monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ES2016,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.CommonJS,
  noEmit: true,
  typeRoots: ['node_modules/@types']
});

// //在初始化之前，先设置MonacoEnvironment
// self.MonacoEnvironment = {
//   //一定要导入对应的代码提示文件,不然页面代码输入没有代码提示
//   getWorker(_workerId: string, label: string) {
//     console.log(_workerId,'AviatorScript', label, 'getWorker');
//     if (label === 'json') {
//       return new jsonWorker()
//     }
//     if (label === 'css' || label === 'scss' || label === 'less') {
//       return new cssWorker()
//     }
//     if (label === 'html') {
//       return new htmlWorker()
//     }
//     if (label === 'typescript' || label === 'javascript') {
//       return new tsWorker()
//     }
//     return new monacoWorker();
//   }
// }

monaco.editor.defineTheme('myTheme', {
  base: 'vs',
  inherit: true,
  colors: {
    // 'editor.foreground': '#000000',
    // 'editor.background': '#EDF9FA',
    // 'editorCursor.foreground': '#8B0000',
    // 'editor.lineHighlightBackground': '#0000FF20',
    // 'editorLineNumber.foreground': '#008800',
    // 'editor.selectionBackground': '#88000030',
    // 'editor.inactiveSelectionBackground': '#88000015',
  },
  rules: [
    { token: 'custom-info1', foreground: '808080', background: 'FFA500', fontStyle: 'bold' },
    { token: 'custom-point', foreground: 'ff0000', fontStyle: 'bold' },
    {
      //注释
      token: 'comment',
      foreground: 'ffa500',
      fontStyle: 'italic underline',
    },
    {
      //操作符
      token: 'operator',
      foreground: 'ffa500',
      fontStyle: 'italic underline',
    },
    { token: 'comment.js', foreground: '008800', fontStyle: 'bold' },
    { token: 'comment.css', foreground: '0000ff' }, // will inherit fontStyle from `comment` above
  ],
});

export default class MonacoEditor implements MonacoEditorProps {
  protected editorInstance: any;
  protected editorInsideInstance: any;
  protected editorOldInstance: any;
  protected aviWorker: any;
  protected htmlBox: HTMLElement;
  protected htmlInsideBox: HTMLElement;
  protected config: ConfigProps;
  protected DiagnosticsAdapter: any;
  protected suggestInstance: IDisposable;
  public codeInfo: {
    oldCode: '', //保存删除的脚本
    insideOldCode: any[],
    undoList: any[], // 回退列表
    insideCodeSnip?: any, //inside片段
    outsideCodeSnip?: any
    insideCode?: string //inside脚本
  };//inside脚本
  // private pointPosition: [];
  private status: string;
  public connectRef: any;

  constructor(config: ConfigProps) {
    this.htmlBox = document.getElementById(config.tag) as HTMLElement;
    // this.htmlInsideBox = document.getElementById(config.insideTag) as HTMLElement;
    // this.editorOldInstance = ;
    this.config = config;
    this.codeInfo = { insideCode: '', insideOldCode: [], undoList: [], oldCode: '' }
    this.status = 'init'
    this.suggestInstance = null;
    this.connectRef = reactive({
      status: 'init'
    })
  }

  async init() {
    await this.setTheme();
    if (this.config?.languageConfig?.name === 'sql') {
      await this.registerLanguage({
        name: 'sql',
        autoCompleteType: 0,
        suggestions: {
          keywords: sqlLanguage.keywords,
          operators: sqlLanguage.operators,
          // functions: sqlLanguage.builtinFunctions,
          variables: sqlLanguage.builtinVariables,
        },
        monarchTokens: {
          tokenizer: {
            root: [
              [/\[(.+?)\]/, 'custom-point'],
            ]
          }
        }
      });
    } else {
      await this.registerLanguage({
        name: 'AviatorScript',
        autoCompleteType: 0,
        suggestions: {
          functions: aviSuggestions,
          keywords: aviMonarchs.keywords,
          typeKeywords: aviMonarchs.typeKeywords,
          operators: aviMonarchs.operators,
        },
        monarchTokens: {
          ...aviMonarchs
        }
      })
    }
    // self.onmessage = (e) => {
    //   console.log(669, e, monacoWorker.initialize);
    //   monacoWorker.initialize((ctx) => {
    //     return new TodoLangWorker(ctx)
    //   });
    // };

    (window as any).MonacoEnvironment = {
      getWorker: function (moduleId, label) {
        console.log(moduleId, label === 'AviatorScript', 2, label);
        if (label === 'AviatorScript') {
          // return './language-service/todoLangWorker.js';
          const worker = new TodoLangWorker()
          return worker;
        } else if (label === 'sql') {
          const worker = new TodoLangWorker()
          return worker;
        }
        return new monacoWorker();
      }
    }

    monaco.languages.onLanguage(this.config?.languageConfig?.name, () => {
      const client = new WorkerManager(this.config?.languageConfig?.name);
      const worker = (...uris: monaco.Uri[]) => {
        return client.getLanguageServiceWorker(...uris);
      };
      this.DiagnosticsAdapter = new DiagnosticsAdapter(worker);
    });

    // monaco.languages.registerHoverProvider(this.config?.languageConfig?.name || 'AviatorScript', {
    //   // that: this,
    //   provideHover: (model, position, token) => {
    //     // console.log(this, model, position, model.getWordAtPosition(position));
    //     const word = model.getWordAtPosition(position).word;
    //     if (!word) return
    //     //获取字段的位置
    //     const positionNew = model.getWordAtPosition(position);
    //     // console.log(positionNew, positionNew.startColumn);
    //     //TODO,判断是否是[]
    //     const range = new monaco.Range(position.lineNumber, positionNew.startColumn - 1, position.lineNumber, positionNew.endColumn + 1)
    //     //获取中括号中的关键字
    //     const keywords = model.getValueInRange(new monaco.Range(position.lineNumber, positionNew.startColumn, position.lineNumber, positionNew.endColumn));
    //     // console.log(range, keywords);

    //     const reg1 = new RegExp('\\[' + keywords + '\\]', 'g');
    //     const reg2 = new RegExp('\\[' + keywords + '\\]' + '\\[(.+?)\\]', 'g');
    //     // console.log(reg1, reg2);
    //     // const outsideArr = this.getValue().match(reg1);
    //     const outsideArr = model.findMatches('\\[' + keywords + '\\]', true, true, true, null, true, 1000);
    //     // console.log(outsideArr);
    //     let index1: number = 0;//获取第几个
    //     outsideArr.forEach((val, index) => {
    //       if (val.range.startLineNumber === range.startLineNumber && val.range.startColumn === range.startColumn) {
    //         index1 = index
    //       }
    //     })
    //     const a1 = this.codeInfo?.insideCode || ''
    //     const insideArr = a1.match(reg2) || [];
    //     // console.log(outsideArr, a1, insideArr, this.codeInfo?.insideCode);
    //     let id;
    //     if (index1 >= 0 && insideArr.length >= 1) {
    //       const reg3 = new RegExp('\\[(.+?)\\]', 'g');
    //       // console.log(insideArr[index1]);
    //       // const a = insideArr[index1] || ''
    //       const strArr: any = insideArr[index1].match(reg3);
    //       // console.log(strArr);
    //       if (strArr?.length >= 1) {
    //         id = strArr[1].slice(1, strArr[1].length - 1)
    //         console.log(strArr[1], strArr[1].length, id);
    //       }

    //     }
    //     return {
    //       // range: new monaco.Range(
    //       //   1,
    //       //   1,
    //       //   model.getLineCount(),
    //       //   model.getLineMaxColumn(model.getLineCount())
    //       // ),
    //       contents: [
    //         {
    //           supportHtml: true,
    //           value: `<div style="color red; class="test">${id}</div>`
    //         }
    //       ]
    //       // contents: [
    //       //   { value: '**if**' },
    //       //   {
    //       //     value: [
    //       //       id
    //       //     ],
    //       //   },
    //       // ],
    //     };
    //   },
    // });

    this.editorInstance = monaco.editor.create(this.htmlBox, {
      value: this.config?.defaultDoc ? this.config?.defaultDoc : '',
      automaticLayout: true,
      readOnly: this.config?.readOnly ? this.config.readOnly : false,
      language: this.config?.languageConfig?.name || 'AviatorScript',
      lineNumbers: 'on',
      fontSize: 16,
      // theme: 'myTheme',
      // value: this.getCode(),
      folding: true, // 是否启用代码折叠
      links: true, // 是否点击链接
      ...this.config?.prettier,
      scrollbar: {
      },
    });
    // this.editorInsideInstance = monaco.editor.create(this.htmlInsideBox, {
    //   value: this.codeInfo.insideCode
    // })
    // this.editorOldInstance = monaco.editor.createModel(this.codeInfo.oldCode);
    // // const that = this;
    const model = this.editorInstance.getModel();
    // const insideModel = this.editorInsideInstance.getModel();
    // let reg = new RegExp('\\[(.+?)\\]', 'g')
    //只读列
    // if (this.config.readOnlyArr && this.config.readOnlyArr.length) {
    //   // const { doc, lineNumber, start, end } = this.config.readOnlyArr[0];
    //   // const readonlyRange = new monaco.Range(lineNumber, start, lineNumber, end);
    //   // const range = new monaco.Range(lineNumber, start, lineNumber, end);
    //   // this.editorInstance.executeEdits('需要插入的代码/string', [
    //   //   {
    //   //     range: range,
    //   //     text: doc
    //   //     // text: e1
    //   //   }
    //   // ]);
    //   this.editorInstance.onKeyDown(e => {
    //     console.log(e);
    //     this.config.readOnlyArr.forEach(element => {
    //       if (this.getPosition().lineNumber === element.lineNumber) {
    //         this.setPosition(2, 1)
    //         e.stopPropagation()
    //         e.preventDefault()
    //       } else {
    //         // const contains = this.editorInstance.getSelections().findIndex(range => readonlyRange.intersectRanges(range));
    //         return;
    //       }
    //     });
    //   })
    // }
    // this.editorInstance.onKeyDown(e => {
    //   console.log(e);
    // })
    // this.editorInstance.addCommand(monaco.KeyCode.RightArrow, function (e) {
    //   let code = that.getValue();
    //   let { column, lineNumber } = that.getPosition()
    //   console.log(column, e, model.getValueInRange(new monaco.Range(lineNumber, column, lineNumber, column + 1)) === ']');
    //   if (model.getValueInRange(new monaco.Range(lineNumber, column, lineNumber, column + 1)) === ']') {
    //     const arr = model.getLineContent(lineNumber).substring(column, model.getLineContent(lineNumber).length).match(reg)
    //     console.log(arr);
    //     that.setPosition(lineNumber, column + arr[0].length)
    //   } else {
    //     that.setPosition(lineNumber, column)
    //   }
    // })
    // this.editorInstance.addCommand(monaco.KeyCode.LeftArrow, function (e) {
    //   let code = that.getValue();
    //   let { column, lineNumber } = that.getPosition()
    //   console.log(column, e, code.substring(column, column + 1));
    //   console.log(model.getValueInRange(new monaco.Range(lineNumber, column - 1, lineNumber, column)));
    //   console.log(model.getLineCount(), model.getLineLength(lineNumber), model.getLineContent(lineNumber));
    //   if (model.getValueInRange(new monaco.Range(lineNumber, column - 1, lineNumber, column)) === ']') {
    //     const arr = model.getLineContent(lineNumber).substring(0, column).match(reg)
    //     console.log(arr);
    //     that.setPosition(lineNumber, column - arr[arr.length - 1].length - 2)
    //   } else {
    //     that.setPosition(lineNumber, column - 2)
    //   }
    // })
    // this.editorInstance.onDidChangeCursorPosition(e => {  // 隐藏id后， 鼠标定位
    //   if (this.editorInstance.getSelection().endColumn - this.editorInstance.getSelection().startColumn > 0) {//光标选择退出逻辑
    //     return;
    //   }
    //   console.log('onDidChangeCursorPosition', e);
    //   let code = this.getValue();
    //   let { column, lineNumber } = e.position;
    //   if (e.source === 'mouse' || e.source === 'keyboard') {
    //     //定位地址前面是],而且中括号个数为奇数才能跳
    //     console.log(model.getValueInRange(new monaco.Range(lineNumber, column - 1, lineNumber, column)), model.getLineContent(lineNumber).substring(0, column).match(reg));
    //     if (model.getValueInRange(new monaco.Range(lineNumber, column - 1, lineNumber, column)) === ']' && model.getLineContent(lineNumber).substring(0, column).match(reg).length % 2 !== 0) {
    //       console.log(model.getLineContent(lineNumber), model.getLineContent(lineNumber).substring(column - 1), model.getLineContent(lineNumber).substring(column - 1).match(reg));
    //       const arr = model.getLineContent(lineNumber).substring(column - 1).match(reg)
    //       this.setPosition(lineNumber, column + arr[0].length - 1)
    //     }
    //     // const a = this.getCodePosition(e.position.lineNumber, e.position.column - 2)
    //     // console.log(a, this.codeInfo.oldCode.substring(a - 1, a));
    //     // if (this.codeInfo.oldCode.substring(a - 1, a) === ']') {
    //     //   const range = new monaco.Range(e.position.lineNumber, e.position.column, e.position.lineNumber, e.position.column);
    //     //   this.editorInstance.executeEdits('需要插入的代码/string', [
    //     //     {
    //     //       range: range,
    //     //       text: ']'
    //     //     }
    //     //   ]);
    //     // }
    //   } else if (e.source === 'deleteLeft') {
    //     const a = this.getCodePosition(e.position.lineNumber, e.position.column)
    //     console.log(a, this.codeInfo.oldCode, this.codeInfo.oldCode.substring(a, a + 1));
    //     if (this.codeInfo.oldCode.substring(a, a + 1) === ']') {
    //       const range = new monaco.Range(e.position.lineNumber, e.position.column, e.position.lineNumber, e.position.column);
    //       this.editorInstance.executeEdits('需要插入的代码/string', [
    //         {
    //           range: range,
    //           text: ']'
    //         }
    //       ]);
    //     }
    //   }
    // });
    // this.editorInstance.getModel().onDidChangeContent((e) => {
    //   setTimeout(() => {
    //     console.log(e);
    //     const { outsideCodeSnip, insideCodeSnip, oldCode } = this.codeInfo;
    //     //获取所有匹配的中括号
    //     let matches = model.findMatches(/\[(.+?)\]{1}/, true,
    //       true,
    //       false,
    //       null,
    //       true, 1000);
    //     //获取正则匹配的偶数项
    //     matches = matches.map((val, index) => { if (index % 2 !== 0) { return val } }).filter(val => val)
    //     if (this.decorations?.clear) {
    //       this.decorations.clear();
    //     }
    //     this.decorations = this.editorInstance.createDecorationsCollection(matches.map((match): void => {
    //       if (matches.length > 0) {
    //         return {
    //           range: match.range,
    //           options: {
    //             isWholeLine: false,
    //             inlineClassName: 'myInlineDecoration'
    //           }
    //         }
    //       }
    //     }));
    //     // console.log(that.codeInfo.insideCodeSnip);
    //     if (this.codeInfo.outsideCodeSnip && that.codeInfo.insideCodeSnip) {
    //       this.setPosition(e.changes[0]['range']['endLineNumber'], e.changes[0]['range']['endColumn'] + that.codeInfo.insideCodeSnip.length + that.codeInfo.outsideCodeSnip.length - 1)
    //       this.codeInfo.outsideCodeSnip = null
    //       this.codeInfo.insideCodeSnip = null
    //     }
    //     this.codeInfo.oldCode = this.getValue();
    //     console.log(this.getValue());
    //   }, 1)

    // });

    // // 然后，你可以为编辑器添加一个键盘绑定，用于监听suggest命令
    // this.editorInstance.addCommand(monaco.KeyCode.Enter, (e) => {
    //   console.log(444, e);
    //   // 获取当前位置的补全提示
    //   const model = this.editorInstance.getModel();
    //   const position = this.editorInstance.getPosition();
    //   // monaco.editor.getSuggestController(this.editorInstance).triggerSuggest(position);

    //   // 你可以在这里添加你的逻辑，比如记录补全事件
    //   console.log('补全事件触发在位置:', position);
    //   return;
    // });


    // // 你也可以监听补全面板的改变事件，以便在面板出现或隐藏时做出反应
    // this.editorInstance.onDidShowSuggestWidget(() => {
    //   console.log('补全面板显示');
    // });
    // model.onWillChangeModelContent(e => {
    //   console.log(e);
    // })


    model.onDidChangeContent((e) => {
      setTimeout(() => {
        if (this.status === 'init') { //编辑初始化的时候需要退出逻辑
          console.log(this.status);
          this.status = 'change';
          return;
        }
        this.connectRef.status = 'init'
        // console.log(this.editorInstance.getSuggestWidget());
        // if (this.editorInstance.getSuggestWidget() && this.editorInstance.getSuggestWidget().getSelection()) {
        //   // 在此处实现选中建议列表选项后的操作
        // }
        // if (e.isUndoing) {
        //   // console.log(this.codeInfo.insideOldCode.unshift());
        //   this.codeInfo.insideOldCode.pop()
        //   const text = this.codeInfo.insideOldCode.pop();
        //   console.log(text, 1);
        //   this.editorInsideInstance.setValue(text);
        //   return;
        // }
        // console.log(e);
        // const { startColumn, endColumn, endLineNumber, startLineNumber } = e.changes[0].range;
        // const insertText = e.changes[0].text;
        // const reg1 = new RegExp('\\[(.+?)\\]', 'g');
        // const reg2 = new RegExp('\\[(.+?)\\]' + '\\[(.+?)\\]', 'g');
        // const modelMatch = model.findMatches(reg1, true, true, true, null, true, 1000);
        // const insideMatch = insideModel.findMatches(reg2, true, true, true, null, true, 1000);
        // let indexArr = 0//匹配光标前面有几个中括号
        // let indexArr1 = 0 //匹配光标前面以及删除有多少个中括号
        // let modelElement = null;//光标前面最后一个
        // let strLength = 0;//获取光标前面[]后的字段长度
        // let delbeforeText = '';//删除
        // let delafterText = '';
        // let deleteStr = ''//删除字段
        // let delArr = [];
        // console.log('modelMatch：', modelMatch);
        // console.log('insideMatch：', insideMatch);
        // console.log('inside:', insideModel.getValue());
        // console.log('insideCodeSnip：', this.codeInfo.insideCodeSnip);
        // console.log('insertText：', insertText);
        // if (insertText) {//新增 
        //   console.log('新增');
        //   modelMatch.forEach((element, index) => {
        //     if (endLineNumber >= element.range.endLineNumber && endColumn >= element.range.endColumn) {
        //       indexArr = index + 1;
        //       modelElement = element
        //     }
        //   });
        //   if (modelElement) {//TODO
        //     strLength = endColumn - modelElement?.range?.endColumn;
        //   }
        // } else if (insertText === '') {//删除
        //   console.log('删除');
        //   // deleteStr = monaco.editor.createModel(this.codeInfo.oldCode).getValueInRange(new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn));
        //   deleteStr = this.editorOldInstance.getValueInRange(new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn));
        //   // const cursorPos = this.getCodePosition(startLineNumber, startColumn);
        //   // console.log(cursorPos, cursorPos + endColumn - startColumn, this.codeInfo.oldCode);
        //   // deleteStr = this.codeInfo.oldCode.substring(cursorPos - 1, cursorPos + endColumn - startColumn); // 换行符也算
        //   modelMatch.forEach((element, index) => {
        //     // console.log(startLineNumber, element.range.endLineNumber, startColumn, element.range.endColumn);
        //     if (startLineNumber >= element.range.endLineNumber && startColumn >= element.range.endColumn) {
        //       indexArr = index + 1;
        //       modelElement = element;
        //     }
        //   });
        //   console.log(indexArr, modelElement);
        //   delArr = deleteStr.match(reg1) || [];
        //   console.log(delArr);
        //   if (modelElement) {
        //     strLength = model.getValueInRange(new monaco.Range(startLineNumber, modelElement.range.endColumn, endLineNumber, startColumn)).length
        //   }
        //   if (delArr.length) { //删除里面中括号个数
        //     indexArr1 = indexArr + delArr?.length
        //     delbeforeText = deleteStr.substring(0, deleteStr.indexOf(delArr[0]))
        //     delafterText = deleteStr.substring(deleteStr.lastIndexOf(delArr[delArr?.length - 1]) + delArr[delArr?.length - 1].length)
        //     console.log(strLength, delbeforeText, delafterText);
        //   }
        // }
        // console.log('modelElement：', modelElement);
        // console.log('indexArr：', indexArr);
        // console.log('deleteStr：', deleteStr);
        // console.log('delafterText:', delafterText);
        // console.log('delbeforeText:', delbeforeText);
        // console.log(!insertText.match(reg1) && this.isChinese(insertText), deleteStr.match(reg1));
        // if (deleteStr && (!deleteStr.match(reg1) && deleteStr.match(/\]/g)?.length === 1)) {//TODO删除：匹配单个中括号
        //   console.log('删除：匹配单个中括号');
        //   const { startColumn: startColumn1, endColumn: endColumn1, endLineNumber: endLineNumber1, startLineNumber: startLineNumber1 } = insideMatch[indexArr].range;//匹配删除的
        //   // const { startColumn: startColumn2, endColumn: endColumn2, endLineNumber: endLineNumber2, startLineNumber: startLineNumber2 } = insideMatch[indexArr1].range;
        //   delafterText = deleteStr.substring(0, deleteStr.match(/\]/)?.index);
        //   delbeforeText = this.codeInfo.oldCode.match(reg1)[indexArr].substring(0, this.codeInfo.oldCode.match(reg1)[indexArr].length - delbeforeText.length - 1);
        //   console.log('delafterText:', delafterText);
        //   console.log('delbeforeText:', delbeforeText);
        //   this.editorInsideInstance.executeEdits('', [
        //     {
        //       range: new monaco.Range(
        //         startLineNumber1,
        //         startColumn1 + delbeforeText.length,
        //         endLineNumber1,
        //         endColumn1,
        //       ),
        //       text: '',
        //       forceMoveMarkers: true
        //     }
        //   ])
        //   console.log(delbeforeText);
        // }
        // else if ((endColumn !== startColumn && endColumn - startColumn <= insertText.length) || (!insertText.match(reg1) && this.isChinese(insertText))) {//TODO:补全
        //   console.log('补全');
        //   const completeTetx = model.getValueInRange(new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn));//补全字段
        //   console.log(completeTetx, modelElement, 11232);
        //   const insideMatch = insideModel.findMatches(reg2, true, true, true, null, true, 1000);
        //   if (modelElement) {
        //     console.log(modelElement.range);
        //     const { startColumn: startColumn1, endColumn: endColumn1, endLineNumber: endLineNumber1, startLineNumber: startLineNumber1 } = modelElement.range;
        //     const { startColumn: startColumn2, endColumn: endColumn2, endLineNumber: endLineNumber2, startLineNumber: startLineNumber2 } = insideMatch[indexArr - 1].range
        //     const completeText1 = model.getValueInRange(new monaco.Range(endLineNumber1, endColumn1, startLineNumber, startColumn + completeTetx.length)); // 中括号到补全所有字段
        //     console.log(completeText1, 1);
        //     console.log(startLineNumber2,
        //       endColumn2, completeText1.length, completeTetx.length,
        //       endLineNumber,
        //       endColumn2 + endColumn - startColumn);
        //     console.log(this.isChinese(insertText));
        //     if (!insertText.match(reg1) && this.isChinese(insertText)) {
        //       this.editorInsideInstance.executeEdits('', [
        //         {
        //           range: new monaco.Range(
        //             startLineNumber2,
        //             endColumn2 + completeText1.length - completeTetx.length,
        //             endLineNumber,
        //             endColumn2 + completeText1.length + endColumn - startColumn
        //           ),
        //           text: insertText,
        //           forceMoveMarkers: true
        //         }
        //       ])
        //     } else {
        //       this.editorInsideInstance.executeEdits('', [
        //         {
        //           range: new monaco.Range(
        //             startLineNumber2,
        //             endColumn2 + completeText1.length - completeTetx.length,
        //             endLineNumber,
        //             endColumn2 + completeText1.length
        //           ),
        //           text: insertText,
        //           forceMoveMarkers: true
        //         }
        //       ])
        //     }
        //   }
        //   else {
        //     console.log(insertText.match(reg1), this.isChinese(insertText));
        //     if (!insertText.match(reg1) && this.isChinese(insertText)) { //中文补全
        //       console.log(insertText, 99);
        //       this.editorInsideInstance.executeEdits('', [
        //         {
        //           range: new monaco.Range(
        //             startLineNumber,
        //             startColumn,
        //             endLineNumber,
        //             endColumn
        //           ),
        //           text: insertText,
        //           forceMoveMarkers: true
        //         }
        //       ])
        //     } else {
        //       this.editorInsideInstance.executeEdits('', [
        //         {
        //           range: new monaco.Range(startLineNumber,
        //             startColumn,
        //             endLineNumber,
        //             startColumn + completeTetx.length),
        //           text: insertText,
        //           forceMoveMarkers: true
        //         }
        //       ])
        //     }
        //   }
        // }
        // else if (modelElement) { //新增或者删除前面有点位的
        //   console.log('新增或者删除前面有点位的');
        //   const { startColumn: startColumn1, endColumn: endColumn1, endLineNumber: endLineNumber1, startLineNumber: startLineNumber1 } = insideMatch[indexArr - 1].range;//匹配删除前面的中括号位置
        //   if (insertText) {//新增
        //     this.editorInsideInstance.executeEdits('', [
        //       {
        //         range: new monaco.Range(
        //           endLineNumber1,
        //           endColumn1 + strLength,
        //           endLineNumber1,
        //           endColumn1 + strLength,
        //         ),
        //         text: insertText + (this.codeInfo.insideCodeSnip ? this.codeInfo.insideCodeSnip : ''),
        //         forceMoveMarkers: true
        //       }
        //     ])
        //   } else {//删除
        //     console.log(strLength, delbeforeText, delafterText);
        //     if (indexArr1) {
        //       const { startColumn: startColumn2, endColumn: endColumn2, endLineNumber: endLineNumber2, startLineNumber: startLineNumber2 } = insideMatch[indexArr1 - 1].range;
        //       console.log(
        //         startColumn1, endColumn1, endLineNumber2,
        //         startColumn2, endColumn2
        //       );
        //       this.editorInsideInstance.executeEdits('', [
        //         {
        //           range: new monaco.Range(
        //             startLineNumber1,
        //             endColumn1 + strLength,
        //             endLineNumber2,
        //             endColumn2 + delafterText.length,
        //           ),
        //           text: '',
        //           forceMoveMarkers: true
        //         }
        //       ])
        //     } else {//删除不包含[]
        //       this.editorInsideInstance.executeEdits('', [
        //         {
        //           range: new monaco.Range(
        //             startLineNumber1,
        //             endColumn1 + strLength,
        //             endLineNumber1,
        //             endColumn1 + strLength + deleteStr.length,
        //           ),
        //           text: '',
        //           forceMoveMarkers: true
        //         }
        //       ])
        //     }
        //   }
        // } else if (delArr.length) {//删除后展示没有点位，内部code有点位的
        //   console.log('删除后展示没有点位，内部code有点位的');
        //   const { startColumn: startColumn1, endColumn: endColumn1, endLineNumber: endLineNumber1, startLineNumber: startLineNumber1 } = insideMatch[0].range;
        //   const { startColumn: startColumn2, endColumn: endColumn2, endLineNumber: endLineNumber2, startLineNumber: startLineNumber2 } = insideMatch[insideMatch.length - 1].range;
        //   console.log(startLineNumber1,
        //     startColumn1 - delbeforeText.length,
        //     endLineNumber2,
        //     endColumn2 + delafterText.length - 1);
        //   this.editorInsideInstance.executeEdits('', [
        //     {
        //       range: new monaco.Range(startLineNumber1,
        //         startColumn1 - delbeforeText.length,
        //         endLineNumber2,
        //         endColumn2 + delafterText.length,),
        //       text: insertText,
        //       forceMoveMarkers: true
        //     }
        //   ])
        // } else {
        //   console.log('新增或者删除没有点位的');
        //   console.log(endLineNumber,
        //     endColumn,
        //     endLineNumber,
        //     endColumn + strLength, insertText, this.getInsideValue());
        //   console.log(insertText + (this.codeInfo.insideCodeSnip ? this.codeInfo.insideCodeSnip : ''));
        //   this.editorInsideInstance.executeEdits('', [
        //     {
        //       range: new monaco.Range(
        //         endLineNumber,
        //         startColumn,
        //         endLineNumber,
        //         endColumn + strLength),
        //       text: insertText + (this.codeInfo.insideCodeSnip ? this.codeInfo.insideCodeSnip : ''),
        //       forceMoveMarkers: true
        //     }
        //   ])
        // }
        // console.log(this.getValue());
        // console.log(this.editorInsideInstance.getValue());
        // this.codeInfo.insideCodeSnip = '';
        // this.codeInfo.outsideCodeSnip = '';
        // this.codeInfo.oldCode = this.getValue();
        // this.editorOldInstance.setValue(this.codeInfo.oldCode)
      }, 10);
    })
  }

  isChinese(text) {
    const pattern = /[\u4E00-\u9FA5\uF900-\uFA2D]/;
    return pattern.test(text);
  }

  //获取具体位置
  getCodePosition(line, column) {
    let a = 0;
    new Array(line).fill(0).forEach((val, index) => {
      a += this.editorInstance.getModel().getLineLength(index + 1) + 1;//加1是换行符也算一个字符
    })
    return a
  }


  handleConnect(e) {

  }

  //销毁实例
  destroyed() {
    this.editorInstance.dispose();
    this.suggestInstance.dispose();
  }

  //更新配置选项
  updateOptions(e: any) {
    this.editorInstance.updateOptions(e);
  }


  public dispose() {
    this.editorInstance.dispose();
  }
  /**
   * 
   * @param e1 
   * @param e2 insideCode
   */
  initSetValue(e1: string) {
    this.editorInstance.setValue(e1);
  }

  getValue() {
    return this.editorInstance.getValue()
  }

  // getInsideValue() {
  //   return this.editorInsideInstance.getValue()
  // }

  insertText(e1: any, e2?: any) {
    let readOnlyStatus = false
    this.config.readOnlyArr && this.config.readOnlyArr.forEach(element => {
      if (this.getPosition().lineNumber === element.lineNumber) {
        readOnlyStatus = true
      }
    });
    if (readOnlyStatus) return;

    const position = this.getPosition();
    const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
    this.editorInstance.executeEdits('需要插入的代码/string', [
      {
        range: range,
        // text: e1 + (e2 ? e2 : '')
        text: e1
      }
    ]);
    console.log(e1, e2);
    this.codeInfo.outsideCodeSnip = e1
    this.codeInfo.insideCodeSnip = e2
    this.editorInstance.focus();
  }

  copyToClipboard(text: string) {
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  copy() {
    // this.editorInstance.getAction('editor.action.clipboardCopyAction')
    this.editorInstance.trigger('editor', 'editor.action.clipboardCutAction');
    this.copyToClipboard(this.editorInstance.getValue())
  }

  //获取光标位置
  getPosition() {
    return this.editorInstance.getPosition();
  }

  setPosition(lineNumber: number, column: number) {
    console.log(lineNumber, column);
    // console.log(this.getPosition());
    this.editorInstance.setPosition({ lineNumber, column });
    // console.log(this.getPosition());
  }

  setLanguage(val: any) {
    console.log(val);
    this.clearMistake(this.editorInstance.getModel()?.getLanguageId())
    monaco.editor.setModelLanguage(this.editorInstance.getModel(), val || 'javascript')
  }

  setTheme() {
    monaco.editor.setTheme('myTheme');
    // //长度
    // monaco.languages.registerCodeLensProvider('javascript', {
    //   provideCodeLenses: function (model, token) {
    //     return {
    //       lenses: [
    //         {
    //           range: {
    //             startLineNumber: 0,
    //             startColumn: 1,
    //             endLineNumber: 2,
    //             endColumn: 1,
    //           },
    //           id: 'First Line',
    //           command: {
    //             id: commandId,
    //             title: 'First Line',
    //           },
    //         },
    //       ],
    //       dispose: () => { },
    //     };
    //   },
    //   resolveCodeLens: function (model, codeLens, token) {
    //     console.log(codeLens);
    //     return codeLens;
    //   },
    // });
  }

  // 标记错误信息
  markMistake(data: any) {
    console.log(data);
    monaco.editor.setModelMarkers(
      this.editorInstance.getModel(),
      'AviatorScript',
      data
      //   [
      //     {
      //     startLineNumber,
      //     startColumn,
      //     endLineNumber,
      //     endColumn,
      //     // Hint = 1,
      //     // Info = 2,
      //     // Warning = 4,
      //     // Error = 8
      //     severity: monaco.MarkerSeverity['Warning'], // type可以是Error,Warning,Info
      //     message: message
      //   }
      // ]
    )
  }

  clearMistake(e: string) {
    console.log(545, this.editorInstance.getModel());
    monaco.editor.setModelMarkers(
      this.editorInstance.getModel(),
      e,
      []
    )
  }

  //   格式化代码 getAction
  // editor.getAction(‘editor.action.formatDocument’).run() //格式化代码
  //   editor.trigger("myapp", "undo");//触发撤销
  // editor.trigger("myapp", "redo");//触发重做
  // 格式化代码
  formatCode() {
    const formatFn = () => {
      try {
        return format(this.getValue(), {
          language: 'mysql',
          tabWidth: 2,
          keywordCase: 'upper',
          linesBetweenQueries: 2,
        });
      } catch (e: any) {
        const { message } = e
        console.log(message);
        const list = message.split(' ')
        const line = list.indexOf('line')
        const column = list.indexOf('column')
        this.markMistake({
          startLineNumber: Number(list[line + 1]),
          endLineNumber: Number(list[line + 1]),
          startColumn: Number(list[column + 1]),
          endColumn: Number(list[column + 1])
        }, 'Error', message)
      }
    }
    monaco.languages.registerDocumentFormattingEditProvider('sql', {
      provideDocumentFormattingEdits(model): any {
        return [{
          text: formatFn(),
          range: model.getFullModelRange()
        }]
      }
    })
  }

  async getFileContent(e: string) {
    let libSource;
    await fetch(e, {
      mode: 'no-cors',
    })
      .then(response => response.text()).then(response => {
        libSource = response
      })
    // console.log(libSource);
    return libSource
  }

  //代码自动补全
  async setAutoComplete(languageConfig: ConfigProps['languageConfig']) {
    const { suggestions, autoCompleteType }: any = languageConfig;
    if (autoCompleteType === 0) {
      this.suggestInstance = monaco.languages.registerCompletionItemProvider(languageConfig.name, {
        //   triggerCharacters: ['$'],
        //   replaceTriggerChar: true,
        provideCompletionItems: function () {
          let newSuggestions: any = [];
          Object.keys(suggestions as any).forEach((item: any) => {
            newSuggestions.push(...suggestions[item]);
          })
          return {
            suggestions: newSuggestions.map((item: any) => {
              return ({
                label: item.label ? item.label : item,// 显示的提示内容
                kind: item?.kind ? item.kind : monaco.languages.CompletionItemKind.Function,// 用来显示提示内容后的不同的图标
                insertText: item.label ? item.label : item, // 选择后粘贴到编辑器中的文字
                // detail: '123', // 提示内容后的说明
                // insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              });
            })
          };
        },
      });
      // monaco.languages.registerCompletionItemProvider('AviatorScript', {
      //   provideCompletionItems: () => {
      //     aviSuggestions.forEach(suggestion => {
      //       delete suggestion.range;
      //     });
      //     return {
      //       suggestions: aviSuggestions
      //     };
      //   }
      // })
    } else {
      //addExtraLib添加库
      // let libSource: any;
      // await fetch('./index.d.ts', {
      //   mode: 'no-cors',
      // })
      //   .then(response => response.text()).then(response => {
      //     libSource = response
      //   })
      // monaco.languages.typescript.javascriptDefaults.addExtraLib(libSource, 'index.d.ts');
    }
    //注册语法片段
    // monaco.languages.registerCompletionItemProvider(this.config.language, {
    //   provideCompletionItems: async (model, position) => {
    //     // const wordUntil = model.getWordUntilPosition(position);
    //     // const defaultRange = new monaco.Range(position.lineNumber, wordUntil.startColumn, position.lineNumber, wordUntil.endColumn);
    //     const result: monaco.languages.CompletionList = {
    //       suggestions: []
    //     };
    //     await this.getFileContent('./javascriptSnippets.json').then((res: any) => {
    //       let snippets: any;
    //       snippets = JSON.parse(res);

    //       for (let key in snippets) {
    //         if (snippets.hasOwnProperty(key)) {
    //           result.suggestions.push({
    //             kind: monaco.languages.CompletionItemKind.Snippet,
    //             insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    //             label: snippets[key].prefix,
    //             documentation: snippets[key].description,
    //             insertText: snippets[key].body.join('\n'),
    //             // range: undefined
    //           });
    //         }
    //       }
    //     })
    //     // console.log(result);
    //     return result;
    //   }
    // }
    // );
  }

  creatWorker() {
    // worker.initialize((ctx: worker.IWorkerContext, createData: ICreateData) => {
    //   console.log(22);
    //   return new WorkerManager(ctx, createData);
    // });
    // let modal = this.editorInstance.getModel();
    // const worker = monaco.editor.createWebWorker({
    //   moduleId: modal?.getLanguageId(),
    //   label: 'sql',
    //   createData: {
    //     languageId: 'sql',
    //   }
    // });
    // console.log(worker);


    // self.onmessage = (message: any) => {
    //   // worker.parse(this.editorInstance)
    //   //使用内置的worker.initialize初始化我们的 worker，并使用TodoLangWorker进行必要的方法代理
    //   monacoWorker.initialize((ctx: monaco.worker.IWorkerContext, createData: any) => {
    //     return new WorkerManager(ctx, createData)
    //   });
    // };
    // self.addEventListener('message', function (e) {
    //   console.log('get:message', self, e, 1239);
    // });
  }

  async monarchToken(languageConfig: ConfigProps['languageConfig']) {
    //语法高亮-和theme搭配
    // console.log(languageConfig.monarchTokens, languageConfig.name, 11221122212229);
    monaco.languages.setMonarchTokensProvider(languageConfig.name, languageConfig.monarchTokens);
    // await monaco.languages.setMonarchTokensProvider(languageConfig.name, {
    //   tokenizer: {
    //     root: [
    //       [/^\[\d/, { token: 'custom-error' }],
    //       [/\[error\]/, 'custom-error'],
    //       [/\[info\]/, { token: 'custom-info' }],
    //       [/^\[warning\]/, { token: 'custom-warning' }]
    //     ]
    //   }
    // });
  }

  async registerLanguage(languageConfig: ConfigProps['languageConfig']): void {
    await monaco.languages.register({ id: languageConfig.name });
    await this.setAutoComplete(languageConfig)
    await languageConfig.monarchTokens && this.monarchToken(languageConfig)
  }
}

