var Preprocessor = require("./preprocessor");

/* Run the self-contained preprocessing pipeline over C source and return the
   candidate function-declaration strings — the same kind of extraction the regex
   backend feeds into RegexParser (comments + function bodies stripped, only
   parenthesised semicolon-delimited expressions kept).

   Used by the AI backend's "declarations" input mode, so the model can be fed just
   the declarations (mirroring how the regex backend sees the file) instead of the
   whole source. */
function extractDeclarations(content: string, additionalDirectives: string, lonelyIfActive: boolean): string[] {
	const directives = additionalDirectives || "";
	const preprocessor = new Preprocessor(`${directives}\n${content}`);
	preprocessor.removeComments().mergeLineEscapes().removeExternC();
	if (lonelyIfActive) {
		preprocessor.activateSimpleIfBlocks();
	}
	preprocessor.preprocess();
	preprocessor.input = directives + "\n" + preprocessor.input;
	preprocessor.preprocess();
	preprocessor.removePreprocessorDirectives().removeCompoundExpressions().filterByRoundBraces();
	return preprocessor.mergeWhitespace().getExpressions();
}

if (typeof module === "object") {
	module.exports = extractDeclarations;
}
