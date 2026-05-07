export interface RegisterLanguageModule {
  keywords: Array<string>,
  typeKeywords: Array<string>,
  operators: Array<string>,
  symbols: RegExp,
  escapes: RegExp
}

enum AutoCompleteTypeEnum {
  'completionItem'
}

export interface ConfigProps {
  tag:string;
  insideTag:string;
  defaultDoc: string;
  readOnly: boolean;
  readOnlyArr: any;
  automaticLayout: boolean;//自动布局
  theme: string;
  lineNumbers: string;//行号展示
  tabsize: number;// tab 缩进长度
  fontFamily: string;
  fontSize: number;
  minimap: {
    enabled: boolean;// 关闭小地图
  },
  prettier: {
    // wordWrap: string,
    // wordWrapColumn: number,
    // // try "same", "indent" or "none"
    // wrappingIndent: string,
  }
  languageConfig: {
    name: 'javascript' | 'text/html' | 'sql' | 'AviatorScript';//语言
    autoCompleteType?: AutoCompleteTypeEnum
    suggestions?: {
      keywords?: any,
      typeKeywords?: any,
      operators?: any,
      symbols?: any,
      escapes?: any,
      functions?: any,
      variables?: any,
    },
    monarchTokens?: any
  }
  scrollbar: {
    overviewRulerBorder: false, // 不要滚动条的边框
  }

}

export interface MonacoEditorProps {
  registerLanguage: (data: RegisterLanguageModule) => void;
}