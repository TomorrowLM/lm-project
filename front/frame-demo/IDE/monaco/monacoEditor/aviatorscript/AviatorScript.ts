import * as monaco from 'monaco-editor';
// import monarch from './monarch';
// import suggestions from './suggestions';
import GrammarParser from './grammar/GrammarParser.mjs';
class AviatorScript {
    language: 'AviatorScript'

    constructor() {
        // this.language = 'aviatorscript';
        // monaco.languages.register({ id: this.language });
        // this.configHighlight();
        // this.configSuggestions();
        this.grammarParser = new GrammarParser();
    }

    getLanguage() {
        return this.language;
    }

    configHighlight() {
        monaco.languages.setMonarchTokensProvider(this.language, monarch);
    }

    configSuggestions() {

        monaco.languages.registerCompletionItemProvider(this.language, {
            provideCompletionItems: () => {
                suggestions.forEach(suggestion => {
                    delete suggestion.range;
                });
                return {
                    suggestions
                };
            }
        })
    }

    changeContent(editor) {
        let model = editor.getModel();
        // console.info("onDidChangeModelContent-model:", model);

        let textToValidate = model.getValue();
        if (!textToValidate) {
            return;
        }
        let code = textToValidate + '\n';
        let astJson = this.grammarParser.parse(code);
        console.log(astJson)
        let markers = [];

        let isError = false;
        for (let i = 0; i < astJson.errors.length; i++) {
            let error = astJson.errors[i];
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: error.line,
                startColumn: error.column,
                endLineNumber: error.line,
                endColumn: error.column,
                message: error.message
            });
            isError = true;
        }

        for (let i = 1; i < astJson.ast.children.length - 1; i++) {
            let child = astJson.ast.children[i];
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: child.line,
                startColumn: child.column,
                endLineNumber: child.line,
                endColumn: child.column,
                message: child.text
            });
            isError = true;
        }
        console.log(markers, model);
        monaco.editor.setModelMarkers(model, this.language, markers);
    }

    format(code) {
        let astJson = this.grammarParser.parse(code);
        let newCode = formatCode(astJson);
        return newCode;
    }
}


let indentTexts = [];

function formatCode(astJson) {
    indentTexts = [];

    let text = getAllTextFromASTNode(astJson.ast);

    text = text.replace(/\n\s+\n/g, '\n\n');
    text = text.replace(/(([,=] |[\(])[+-]+) (\w+)/g, '$1$3');
    text = text.replace(/\+ ,/g, '+,');

    return text;
}

let noSpaceTokens = ['(', ')', ';', '.', ',', '}', '[', ']'];
let noPreSpaceTokens = ['(', '{', '.', '"', '\'', '['];
let nextSpaceTokens = ['if', '=', '+', '-', '*', '/', '%', '**', '>', '<', '<=', '>=', '!=', '==', '=~'];

let noSpacePairTokens = [
    ['*', ';']
]
let preText = '';
let isFirstToken = true;

function isNoSpacePairTokens(text, preText) {

    for (let i = 0; i < noSpacePairTokens.length; i++) {
        if (noSpacePairTokens[i][0] === preText && noSpacePairTokens[i][1] === text) {
            return true;
        }
    }
    return false;
}

// debugOutput("getAllTextFromASTNode-end");

function getAllTextFromASTNode(node) {
    if (!node) {
        return '';
    }
    let text = '';

    if (node.text && '<EOF>' !== node.text && ' ' !== node.text) {
        if (node.text === '}' || node.text === 'end') {
            indentTexts.pop();
        }
        if (isFirstToken && indentTexts.length > 0) {
            text += indentTexts.join('');
        }
        if ('RegularLikeRight' === node.rule) {
            text += node.text.replace(/=~\s*/, ' =~ ');
        } else if (isFirstToken ||
            isNoSpacePairTokens(node.text, preText) ||
            (noSpaceTokens.indexOf(node.text) > -1 && nextSpaceTokens.indexOf(preText) === -1) ||
            noPreSpaceTokens.indexOf(preText) > -1) {
            text += node.text;
        } else {
            if (node.column > 1 && node.text !== '\n') {
                text += ' ';
            }
            text += node.text;
        }
        preText = node.text;
        if (node.text === '{' || node.text === '->') {
            indentTexts.push('  ');
        }
        if (node.text === '\n' || 'Comment' === node.rule) {
            isFirstToken = true;
        } else {
            isFirstToken = false;
        }
    }
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            text += getAllTextFromASTNode(node.children[i]);
        }
    }
    return text;
}

export default AviatorScript;