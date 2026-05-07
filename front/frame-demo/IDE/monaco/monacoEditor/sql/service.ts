import { InputStream, CommonTokenStream } from 'antlr4';
import { MySQL } from 'dt-sql-parser';

function parse(code: string): { ast: TodoExpressionsContext, errors: ITodoLangError[] } {
  const parser = new MySQL();
  let astJson = parser.validate(code);
  astJson = astJson.filter(val => {
    if (val.message.includes('extraneous input')) {
      return false
    }
    return true
  })
  console.log(astJson);
  // let markers = [];
  // let isError = false;
  // for (let i = 0; i < astJson.length; i++) {
  //   let error = astJson[i];
  //   console.log(error);
  //   markers.push({
  //     startLineNumber: error.startLine,
  //     startColumn: error.startColumn,
  //     endLineNumber: error.endLine,
  //     endColumn: error.endColumn,
  //     severity: monaco.MarkerSeverity.Error,
  //     message: error.message
  //   });
  //   isError = true;
  // }
  return { ast: {}, errors: astJson }
}

// function parse(code: string): { ast: TodoExpressionsContext, errors: any[] } {
//     // const inputStream = new ANTLRInputStream(code);
//     // const lexer = new TodoLangGrammarLexer(inputStream);
//     // lexer.removeErrorListeners()
//     // const todoLangErrorsListner = new TodoLangErrorListener();
//     // lexer.addErrorListener(todoLangErrorsListner);
//     // const tokenStream = new CommonTokenStream(lexer);
//     // const parser = new TodoLangGrammarParser(tokenStream);
//     // parser.removeErrorListeners();
//     // parser.addErrorListener(todoLangErrorsListner);
//     // const ast =  parser.todoExpressions();
//     // const errors: ITodoLangError[]  = todoLangErrorsListner.getErrors();
//     // return {ast, errors};
// }
export function parseAndGetASTRoot(code: string): TodoExpressionsContext {
  const { ast } = parse(code);
  return ast;
}
export function parseAndGetSyntaxErrors(code: string): any[] {
  const { errors } = parse(code);
  return errors;
}