import GrammarParser from "./GrammarParser.mjs";

var grammarParser = new GrammarParser();

var result = grammarParser.parse("1+");
console.info(result);