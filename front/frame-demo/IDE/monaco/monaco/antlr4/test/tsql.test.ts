import { CommonTokenStream, CharStreams } from 'antlr4ts';
import { TSqlLexer } from "../src/grammar-output/tsql/TSqlLexer";
import { TSqlParser } from "../src/grammar-output/tsql/TSqlParser";
import { ParserErrorListener } from 'antlr4ts';

export class SelectErrorListener implements ParserErrorListener {
  private _parserErrorSet: Set<any> = new Set();

  syntaxError(_rec, _ofSym, line, charPosInLine, msg) {
    let endCol = charPosInLine + 1;
    this._parserErrorSet.add({
      startLine: line,
      endLine: line,
      startCol: charPosInLine,
      endCol: endCol,
      message: msg,
    })
  }

  clear() {
    this._parserErrorSet.clear();
  }

  get parserErrors() {
    return Array.from(this._parserErrorSet)
  }
}

class SelectParser {
  private _errorListener = new SelectErrorListener();

  createLexer(input: string) {
    const inputStream = CharStreams.fromString(input);
    const lexer = new TSqlLexer(inputStream);
    this._errorListener.clear();
    lexer.removeErrorListeners(); // 移除 Antlr4 内置的 ErrorListener
    lexer.addErrorListener(this._errorListener)
    return lexer
  }

  createParser(input: string) {
    const lexer = this.createLexer(input);
    const tokens = new CommonTokenStream(lexer);
    const parser = new TSqlParser(tokens);
    parser.removeErrorListeners(); // 移除 Antlr4 内置的 ErrorListener
    parser.addErrorListener(this._errorListener);
    return parser
  }

  parse(sql: string) {
    const parser = this.createParser(sql)
    const parseTree = parser.select_statement();
    console.log(this._errorListener.parserErrors);
    return {
      parseTree,
      errors: this._errorListener.parserErrors,
    };
  }
}


test("can parse and tokenize a query", () => {
  // 试一下效果
  const selectParser = new SelectParser();
  const { parseTree, errors } = selectParser.parse('SELECT id FROM FRO');
  console.log(1, parseTree, errors);
});