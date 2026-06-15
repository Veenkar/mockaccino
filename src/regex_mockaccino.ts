var Preprocessor = require("./preprocessor");
var RegexParserLib = require("./regex_parser");
var RegexParser = RegexParserLib.RegexParser;
var RegexParserToolbox = RegexParserLib.RegexParserToolbox;
var FunctionStringifier = require("./function_stringifier");
var ImplGenerator = require("./impl_generator");
var Mockaccino = require("./mockaccino");
var CppMockgen = require("./cpp_mockgen");


/* Regex-parser backend: the original Mockaccino behaviour. Runs the
   self-contained Preprocessor over the source, extracts candidate function
   declaration strings, and parses them with RegexParser — no compiler or include
   resolution required, so it works on partial/uncompilable snippets. The three
   base-class hooks delegate to RegexParser / ImplGenerator. */
class RegexMockaccino extends Mockaccino {
	public c_functions_strings: string[] = [];
	private regexParser: typeof RegexParser;
	private stringifier: typeof FunctionStringifier;
	private implGenerator: any;
	private rawContent: string;

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string) {
		super(uri, config, version, workspace_folder, template_path, "regex");

		this.rawContent = content;
		this.c_functions_strings = this.preprocess(content);

		const parserConfig: ParserConfig = {
			skip_functions_with_implicit_return_type: this.config.get('skipFunctionsWithImplicitReturnType'),
			skip_static_functions: this.config.get('skipStaticFunctions'),
			skip_extern_functions: this.config.get('skipExternFunctions'),
			ignored_function_names: this.parseIgnoredFunctionNames(),
		};
		this.regexParser = new RegexParser(parserConfig, this.c_functions_strings);
		this.stringifier = new FunctionStringifier(this.naming.caps_mock_name, this.naming.caps_stub_name, this.naming.mock_instance_name);
		this.implGenerator = new ImplGenerator(this.regexParser, this.stringifier);
	}

	protected getMockMethodStrings(): string[] {
		return this.regexParser.getFunctions().map((c_func_info: FunctionInfo) =>
			this.stringifier.mockMethod(c_func_info.returnType, c_func_info.name, RegexParserToolbox.projectArgs(c_func_info.arguments))
		);
	}

	protected getMockImplStrings(): string[] {
		return this.implGenerator.getMockImplStrings();
	}

	protected getStubImplStrings(): string[] {
		return this.implGenerator.getStubImplStrings();
	}

	protected getCppMockClassStrings(): string[] {
		return CppMockgen.buildCppMockStrings(this.rawContent, this.config);
	}

	/* Self-contained C preprocessing → array of candidate function-declaration
	   strings. Owned by this backend because clang handles preprocessing itself. */
	private preprocess(content_raw: string): string[] {
		const additional_preprocessor_directives = this.config.get('additionalPreprocessorDirectives');
		const lonely_if_active = this.config.get('treatLonelyPreprocIfAsActive');

		console.log(`Add preproc: ${additional_preprocessor_directives}`);
		let preprocessor = new Preprocessor(`${additional_preprocessor_directives}\n
			${content_raw}`);
		preprocessor.removeComments().mergeLineEscapes().removeExternC();
		if (lonely_if_active) {
			preprocessor.activateSimpleIfBlocks();
		}
		preprocessor.preprocess();
		preprocessor.input = additional_preprocessor_directives + "\n" + preprocessor.input;
		preprocessor.preprocess();
		preprocessor.removePreprocessorDirectives().removeCompoundExpressions().filterByRoundBraces();
		console.log("preproc:");
		console.log(preprocessor.get());
		const c_functions_strings = preprocessor.mergeWhitespace().getExpressions();
		console.log("fun strings:");
		console.log(c_functions_strings);
		return c_functions_strings;
	}
}


if(typeof module === "object")
{
    module.exports = RegexMockaccino;
}
