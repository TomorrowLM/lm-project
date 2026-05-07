import {
  CommonTokenStream,
  CharStreams,
  ParserErrorListener,
  ANTLRInputStream,
} from "antlr4ts";
import { MySQLLexer } from "../src/grammar-output/mysql/MySQLLexer";
import { MultiQueryMySQLParser } from "../src/grammar-output/mysql/MultiQueryMySQLParser";

//使用 ParserErrorListener 收集错误信息
class SelectErrorListener implements ParserErrorListener {
  private _parserErrorSet: Set<any> = new Set();

  syntaxError(_rec, _ofSym, line, charPosInLine, msg) {
    let endCol = charPosInLine + 1;
    this._parserErrorSet.add({
      startLine: line,
      endLine: line,
      startCol: charPosInLine,
      endCol: endCol,
      message: msg,
    });
  }

  clear() {
    this._parserErrorSet.clear();
  }

  get parserErrors() {
    return Array.from(this._parserErrorSet);
  }
}

class SelectParser {
  private _errorListener = new SelectErrorListener();

  createLexer(input: string) {
    // const inputStream = CharStreams.fromString(input);
    const inputStream = new ANTLRInputStream(input);
    console.log(inputStream);
    // console.log(new ANTLRInputStream(input));
    const lexer = new MySQLLexer(inputStream);
    console.log(lexer);
    this._errorListener.clear();
    lexer.removeErrorListeners(); // 移除 Antlr4 内置的 ErrorListener
    lexer.addErrorListener(this._errorListener);
    return lexer;
  }

  createParser(input: string) {
    const lexer = this.createLexer(input);
    const tokens = new CommonTokenStream(lexer);
    const parser = new MultiQueryMySQLParser(tokens);
    parser.removeErrorListeners(); // 移除 Antlr4 内置的 ErrorListener
    parser.addErrorListener(this._errorListener);
    return parser;
  }

  parse(sql: string) {
    const parser = this.createParser(sql);
    const parseTree = parser.selectStatement();
    // console.log(this._errorListener.parserErrors);
    return {
      parseTree,
      errors: this._errorListener.parserErrors,
    };
  }
}

test("can parse and tokenize a query", () => {
  // 试一下效果
  const selectParser = new SelectParser();
  // const parseTree = selectParser.parse("SELECT * FROM table1");
  const parseTree = selectParser.parse(`
  select a frmo 1;
  `);
  console.log(parseTree);
});