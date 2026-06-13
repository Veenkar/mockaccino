var Preprocessor = require("./preprocessor");
var RegexParserLib = require("./regex_parser");
var RegexParser = RegexParserLib.RegexParser;
var RegexParserToolbox = RegexParserLib.RegexParserToolbox;
var Naming = require("./naming");
var ImplGenerator = require("./impl_generator");
var TemplateRenderer = require("./template_renderer");
var FileWriter = require("./file_writer");


interface GenerationResult {
	result: number;
	message: string;
	mock_count: number;
}


/* Orchestrator. Owns config parsing and the preprocessing pipeline, then wires
   together the single-responsibility collaborators (Naming, ImplGenerator,
   TemplateRenderer, FileWriter) to produce the mock/stub files. The name fields
   are mirrored onto the instance because the templates reference them as
   `instance.*` and the tests read them directly. */
class Mockaccino {
	private config: any;
	private content_raw: string;
	private content: string;
	private uri: any;
	private version: string;
	private copyright!: string;
	private localTime!: string;
	private output_path: string = "";
	private workspace_folder: string = "";
	private ignored_function_names: string[] = [];
	private template_path: string;
	public c_functions_strings: string[] = [];
	public file_written: string = "";

	// Mirrored from Naming for the template `instance.*` contract and the tests.
	private naming: any;
	public name: string;
	public caps_name: string;
	public header_name: string;
	public mock_name: string;
	public mock_instance_name: string;
	public caps_mock_name: string;
	public caps_stub_name: string;
	public filename: string;

	private regexParser: typeof RegexParser;
	private implGenerator: any;
	private renderer: any;
	private writer: any;

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string) {
		this.config = config;
		this.content_raw = content;
		this.uri = uri;
		this.version = version;
		this.workspace_folder = workspace_folder;
		this.template_path = template_path;

		this.parseConfig();
		this.content = this.preprocess();

		this.naming = new Naming(this.uri.fsPath);
		this.name = this.naming.name;
		this.caps_name = this.naming.caps_name;
		this.header_name = this.naming.header_name;
		this.mock_name = this.naming.mock_name;
		this.mock_instance_name = this.naming.mock_instance_name;
		this.caps_mock_name = this.naming.caps_mock_name;
		this.caps_stub_name = this.naming.caps_stub_name;
		this.filename = this.naming.filename;

		this.resolveOutputPath();

		const parserConfig: ParserConfig = {
			skip_functions_with_implicit_return_type: this.config.get('skipFunctionsWithImplicitReturnType'),
			skip_static_functions: this.config.get('skipStaticFunctions'),
			skip_extern_functions: this.config.get('skipExternFunctions'),
			ignored_function_names: this.ignored_function_names,
		};
		this.regexParser = new RegexParser(parserConfig, this.c_functions_strings);
		this.implGenerator = new ImplGenerator(this.regexParser, this.caps_mock_name, this.caps_stub_name, this.mock_instance_name);
		this.renderer = new TemplateRenderer(this.template_path, this);
		this.writer = new FileWriter(this.output_path, this.naming);

		console.log(`Output path: ${this.output_path}`);
	}

	private parseConfig() {
		const ignored_function_names_string = this.config.get('ignoredFunctionNames');
		if (typeof ignored_function_names_string === "string") {
			this.ignored_function_names = ignored_function_names_string
				.split(',')
				.map((name: string) => name.trim())
				.filter((name: string) => name.length > 0);
		}

		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		this.localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

		const currentYear = now.getFullYear();
		this.copyright = this.config.get('copyright')
			.replace(/\$YEAR/g, currentYear)
			.split("\n")
			.map((line: string) => ` * ${line}`)
			.join("\n");
		this.copyright = this.copyright.replace(/[ \t]+$/gm, "");
	}

	private preprocess(): string {
		const additional_preprocessor_directives = this.config.get('additionalPreprocessorDirectives');
		const lonely_if_active = this.config.get('treatLonelyPreprocIfAsActive');

		console.log(`Add preproc: ${additional_preprocessor_directives}`);
		let preprocessor = new Preprocessor(`${additional_preprocessor_directives}\n
			${this.content_raw}`);
		preprocessor.removeComments().mergeLineEscapes().removeExternC();
		if (lonely_if_active) {
			preprocessor.activateSimpleIfBlocks();
		}
		preprocessor.preprocess();
		preprocessor.input = additional_preprocessor_directives + "\n" + preprocessor.input;
		preprocessor.preprocess();
		preprocessor.removePreprocessorDirectives().removeCompoundExpressions().filterByRoundBraces();
		const content = preprocessor.get();
		this.c_functions_strings = preprocessor.mergeWhitespace().getExpressions();
		console.log("preproc:");
		console.log(content);
		console.log("fun strings:");
		console.log(this.c_functions_strings);
		return content;
	}

	private resolveOutputPath() {
		this.output_path = this.config.get('outputPath') || "";
		if (this.output_path.includes("${workspaceFolder}")) {
			if (this.workspace_folder === "") {
				console.log("Not in a workspace, files will be put in the input file folder.");
				this.output_path = "";
			}
			else {
				this.output_path = this.output_path.replace("${workspaceFolder}", this.workspace_folder);
			}
		}
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
		const dotIndex = this.filename.lastIndexOf('.');
		const baseName = dotIndex !== -1 ? this.filename.slice(0, dotIndex) : this.filename;
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
