import { TodoLangGrammarParser, TodoExpressionsContext } from "../src/grammar-output/todoLang/TodoLangGrammarParser";
import { TodoLangGrammarLexer } from "../src/grammar-output/todoLang/TodoLangGrammarLexer";
import { ANTLRInputStream, CommonTokenStream } from "antlr4ts";

export default function parseAndGetASTRoot(code: string): TodoExpressionsContext {
    const inputStream = new ANTLRInputStream(code);
    const lexer = new TodoLangGrammarLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new TodoLangGrammarParser(tokenStream);
    // Parse the input, where `compilationUnit` is whatever entry point you defined
    return parser.todoExpressions();
}

test("can parse and tokenize a query", () => {
    const ast = parseAndGetASTRoot(`
        ADD TODO "Create an editor"
        COMPLETE TODO "Create an editor"
        `)
    console.log('ast', ast)
});