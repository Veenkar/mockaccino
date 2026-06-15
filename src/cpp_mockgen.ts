var extractCppClassesLib = require("./cpp_class_parser");
var selectionLib = require("./cpp_class_selection");
var cppStringifier = require("./cpp_mock_stringifier");

/* Shared C++ mock-class generation for the heuristic (regex/ai) backends: extract
   classes from the source, apply the mockaccino.cpp.* selection, and render each to a
   mock-class block. Returns [] when disabled or nothing qualifies. The clang backend
   has its own AST-based extraction but reuses the same selection + stringifier. */
function buildCppMockStrings(content: string, config: any): string[] {
	if (config.get('cpp.enabled') === false) {
		return [];
	}
	const classes = extractCppClassesLib.extractCppClasses(content);
	return selectCppMockStrings(classes, config);
}

/* Apply selection + stringify to already-extracted classes (used by both the regex
   extractor above and the clang AST extractor). */
function selectCppMockStrings(classes: any[], config: any): string[] {
	const selected = selectionLib.selectMockClasses(classes, {
		onlyVirtualOrInterface: config.get('cpp.onlyVirtualOrInterfaceClasses') !== false,
		interfaceNamePatterns: config.get('cpp.interfaceNamePatterns') || [],
	});
	return selected.map(cppStringifier.stringifyMockClass);
}

if (typeof module === "object") {
	module.exports = { buildCppMockStrings, selectCppMockStrings };
}
