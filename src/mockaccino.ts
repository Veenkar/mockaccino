var Preprocessor = require("./preprocessor");
var RegexParserLib = require("./regex_parser");
var RegexParser = RegexParserLib.RegexParser;
var RegexParserToolbox = RegexParserLib.RegexParserToolbox;
var Naming = require("./naming");
var TemplateContext = require("./template_context");
var ImplGenerator = require("./impl_generator");
var TemplateRenderer = require("./template_renderer");
var FileWriter = require("./file_writer");


interface GenerationResult {
	result: number;
	message: string;
	mock_count: number;
}


/* Orchestrator. Owns config parsing and the preprocessing pipeline, then wires
   together the single-responsibility collaborators (Naming, TemplateContext,
   ImplGenerator, TemplateRenderer, FileWriter) to produce the mock/stub files.
   The values the templates and tests read are owned by `naming` (derived names)
   and `context` (names + per-run doc metadata) rather than mirrored as fields. */
class Mockaccino {
	private config: any;
	private uri: any;
	private naming: any;
	private context: typeof TemplateContext;
	public c_functions_strings: string[] = [];
	public file_written: string = "";

	private regexParser: typeof RegexParser;
	private implGenerator: any;
	private renderer: any;
	private writer: any;

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string) {
		this.config = config;
		this.uri = uri;

		const ignored_function_names = this.parseIgnoredFunctionNames();
		const { localTime, copyright } = this.buildDocMetadata();
		this.c_functions_strings = this.preprocess(content);

		this.naming = new Naming(this.uri.fsPath);
		this.context = new TemplateContext(this.naming, version, localTime, copyright);

		const output_path = this.resolveOutputPath(workspace_folder);

		const parserConfig: ParserConfig = {
			skip_functions_with_implicit_return_type: this.config.get('skipFunctionsWithImplicitReturnType'),
			skip_static_functions: this.config.get('skipStaticFunctions'),
			skip_extern_functions: this.config.get('skipExternFunctions'),
			ignored_function_names: ignored_function_names,
		};
		this.regexParser = new RegexParser(parserConfig, this.c_functions_strings);
		this.implGenerator = new ImplGenerator(this.regexParser, this.naming.caps_mock_name, this.naming.caps_stub_name, this.naming.mock_instance_name);
		this.renderer = new TemplateRenderer(template_path, this.context);
		this.writer = new FileWriter(output_path, this.naming);

		console.log(`Output path: ${output_path}`);
	}

	private parseIgnoredFunctionNames(): string[] {
		const ignored_function_names_string = this.config.get('ignoredFunctionNames');
		if (typeof ignored_function_names_string !== "string") {
			return [];
		}
		return ignored_function_names_string
			.split(',')
			.map((name: string) => name.trim())
			.filter((name: string) => name.length > 0);
	}

	private buildDocMetadata(): { localTime: string, copyright: string } {
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		const localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

		const currentYear = now.getFullYear();
		const copyright = this.config.get('copyright')
			.replace(/\$YEAR/g, currentYear)
			.split("\n")
			.map((line: string) => ` * ${line}`)
			.join("\n")
			.replace(/[ \t]+$/gm, "");
		return { localTime, copyright };
	}

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

	private resolveOutputPath(workspace_folder: string): string {
		let output_path = this.config.get('outputPath') || "";
		if (output_path.includes("${workspaceFolder}")) {
			if (workspace_folder === "") {
				console.log("Not in a workspace, files will be put in the input file folder.");
				output_path = "";
			}
			else {
				output_path = output_path.replace("${workspaceFolder}", workspace_folder);
			}
		}
		return output_path;
	}

	public mock(): GenerationResult {
		if (this.doubleGenerationBlocked('_mock')) {
			return {
				result: 1,
				message: "Skipping generation: double mocking is disabled and file name contains '_mock'.",
				mock_count: 0,
			};
		}
		if ("file" !== this.uri.scheme) {
			return this.notAFileResult();
		}

		const mock_strings_list = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			`\tMOCK_METHOD(${fn.returnType}, ${fn.name}, (${fn.arguments}));`, RegexParserToolbox.removeArgumentName_ProcessArguments
		);
		const mock_strings = mock_strings_list.join("\n");
		const impl_strings = this.implGenerator.getMockImplStrings().join("\n");
		console.log("mock strings:");
		console.log(mock_strings);

		const header = this.renderer.renderMockHeader(mock_strings);
		const src = this.renderer.renderMockSrc(impl_strings);
		this.file_written = this.writer.writeMock(header, src);

		if (mock_strings_list.length > 0) {
			return {
				result: 0,
				message: `${mock_strings_list.length} mocks written to:\n${this.file_written} (.cc)`,
				mock_count: mock_strings_list.length,
			};
		}
		return this.emptyContentResult();
	}

	public stub(): GenerationResult {
		if (this.doubleGenerationBlocked('_stub')) {
			return {
				result: 1,
				message: "Skipping generation: double mocking is disabled and file name contains '_stub'.",
				mock_count: 0,
			};
		}
		if ("file" !== this.uri.scheme) {
			return this.notAFileResult();
		}

		const stub_strings_list = this.implGenerator.getStubImplStrings();
		const stub_strings = stub_strings_list.join("\n");
		console.log("stub strings:");
		console.log(stub_strings);

		const src = this.renderer.renderStubSrc(stub_strings);
		this.file_written = this.writer.writeStub(src);

		if (stub_strings_list.length > 0) {
			return {
				result: 0,
				message: `${stub_strings_list.length} stubs written to:\n${this.file_written} (.cc)`,
				mock_count: stub_strings_list.length,
			};
		}
		return this.emptyContentResult();
	}

	/* When double mocking is disabled, skip inputs whose base name already ends
	   with the generated suffix (e.g. re-mocking a `*_mock.c`). */
	private doubleGenerationBlocked(suffix: string): boolean {
		if (!this.config.disableDoubleMocking) {
			return false;
		}
		const filename = this.naming.filename;
		const dotIndex = filename.lastIndexOf('.');
		const baseName = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
		return new RegExp(`${suffix}$`, 'i').test(baseName);
	}

	private notAFileResult(): GenerationResult {
		return {
			result: 3,
			message: "Error while generating: opened file is not a file on disk.",
			mock_count: 0,
		};
	}

	private emptyContentResult(): GenerationResult {
		return {
			result: 2,
			message: "Error while generating mock file content.",
			mock_count: 0,
		};
	}
}


if(typeof module === "object")
{
    module.exports = Mockaccino;
}
