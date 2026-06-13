var RegexParserLib = require("./regex_parser");
var RegexParser = RegexParserLib.RegexParser;
var RegexParserToolbox = RegexParserLib.RegexParserToolbox;
var FunctionStringifier = require("./function_stringifier");

/* Generates the C function-wrapper implementation bodies (the .cc strings) for
   the regex backend. It pulls the filtered FunctionInfo[] from the parser,
   derives the argument projections each output needs via RegexParserToolbox, and
   delegates the actual formatting to a (backend-agnostic) FunctionStringifier.
   Depends only on a parser + stringifier, not the whole orchestrator (SRP/DIP). */
class ImplGenerator {
	constructor(
		private regexParser: typeof RegexParser,
		private stringifier: typeof FunctionStringifier,
	) {}

	getMockImplStrings(): string[] {
		return this.regexParser.getFunctions().map((fn: FunctionInfo) =>
			this.stringifier.mockImpl(fn.returnType, fn.name, RegexParserToolbox.projectArgs(fn.arguments))
		);
	}

	getStubImplStrings(): string[] {
		return this.regexParser.getFunctions().map((fn: FunctionInfo) =>
			this.stringifier.stubImpl(fn.returnType, fn.name, RegexParserToolbox.projectArgs(fn.arguments))
		);
	}
}

if (typeof module === "object") {
	module.exports = ImplGenerator;
}
