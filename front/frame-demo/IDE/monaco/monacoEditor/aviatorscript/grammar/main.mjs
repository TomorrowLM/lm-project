import antlr4 from 'antlr4';

import fs from 'fs';

import DSLLexer from './DSLLexer.js';
import DSLParser from './DSLParser.js';

let args = process.argv.splice(2);
let codeDSLPath = args[0] + '/code.dsl';
// console.info("codeDSLPath", codeDSLPath);

const input = fs.readFileSync(codeDSLPath) + '';
// const input = "1+";
// console.info("input", input);

const chars = new antlr4.InputStream(input);
const lexer = new DSLLexer(chars);
const tokens = new antlr4.CommonTokenStream(lexer);
const parser = new DSLParser(tokens);

let errors = [];
class MyErrorListener extends antlr4.error.ErrorListener {
    constructor() {
        super();
    }
    syntaxError(recognizer, offendingSymbol, line, column, message, e) {
        errors.push({ line, column, message })
    }
}

lexer.removeErrorListeners();
lexer.addErrorListener(new MyErrorListener());
parser.removeErrorListeners();
parser.addErrorListener(new MyErrorListener());

parser.buildParseTrees = true;
const tree = parser.root();
// console.info(tree);

class Visitor {
    visitChildren(ctx) {
        if (!ctx) {
            return;
        }

        if (ctx.children) {
            return ctx.children.map(child => {
                if (child.children && child.children.length != 0) {
                    let ast = {
                        line: child.start.line,
                        column: child.start.column,
                        start: child.start.start,
                        stop: child.stop.stop,
                        rule: DSLParser.ruleNames[child.ruleIndex],
                        children: child.accept(this)
                    };
                    return ast;
                } else {
                    if (!child.symbol) {
                        return null;
                    }
                    return {
                        line: child.symbol.line,
                        column: child.symbol.column,
                        start: child.symbol.start,
                        stop: child.symbol.stop,
                        text: child.getText(),
                        rule: DSLLexer.symbolicNames[child.symbol.type]
                    }
                }
            });
        }
    }
}

let result = tree.accept(new Visitor());
// console.info(JSON.stringify(result, "", 4));
console.info(JSON.stringify({
    'ast': {
        'rule': 'root',
        children: result
    },
    'errors': errors
}));