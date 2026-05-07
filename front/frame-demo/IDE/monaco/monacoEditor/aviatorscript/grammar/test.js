// import { GrammarParser } from "./GrammarParser.js";

var GrammarParser = require("./GrammarParser.js");

var grammarParser = new GrammarParser();

var result = grammarParser.parse("1+");
console.info(result);