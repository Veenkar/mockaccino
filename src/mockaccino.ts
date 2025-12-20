var Preprocessor = require("./preprocessor.ts");
var Interpolator = require("./interpolator.ts");
var RegexParserLib = require("./regex_parser.ts");
var RegexParser = RegexParserLib.RegexParser;
var RegexParserToolbox = RegexParserLib.RegexParserToolbox;
const fs = require('fs');
const path = require('path');


interface GenerationResult {
	result: number;
	message: string;
	mock_count: number;
}





class Mockaccino {
	private config: any;
	private content_raw: string;
	private content: string;
	private name: string;
	private caps_name: string;
	private caps_mock_name: string;
	private caps_stub_name: string;
	private filename: string;
	private header_name: string;
	private path: string;
	private defaultMockHeaderPath: string;
	private defaultMockSrcPath: string;
	private defaultStubSrcPath: string;
	private uri: any;
	private mock_name: string;
	private mock_instance_name: string;
	private c_functions_strings: string[] = [];
    private copyright: string;
	private version: string;
	private output_path: string = "";
	private workspace_folder: string = "";
	private skip_static_functions: boolean;
	private skip_extern_functions: boolean;
	private skip_functions_with_implicit_return_type: boolean;
	private ignored_function_names: string[] = [];
	private localTime: string;
	public file_written: string = "";
	private template_path: string;
	private regexParser: RegexParser;

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string) {
		this.config = config;
		this.content_raw = content;
		this.uri = uri;
		this.version = version;
		const additional_preprocessor_directives = this.config.get('additionalPreprocessorDirectives');
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
		this.content = preprocessor.get();
		this.c_functions_strings = preprocessor.mergeWhitespace().getExpressions();
		console.log("preproc:");
		console.log(this.content);
		console.log("fun strings:");
		console.log(this.c_functions_strings);

		this.path = this.uri.fsPath;
		const extIndex = this.path.lastIndexOf('.');
		this.defaultMockHeaderPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_mock' + ".h"
			: this.path + '_mock';
		this.defaultMockSrcPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_mock' + ".cc"
			: this.path + '_mock';
		this.defaultStubSrcPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_stub' + ".cc"
			: this.path + '_stub';

		const pathParts = this.path.split(/[\\/]/);
		this.filename = pathParts[pathParts.length - 1];
		const dotIndex = this.filename.lastIndexOf('.');
		this.name = dotIndex !== -1 ? this.filename.slice(0, dotIndex) : this.filename;
		this.header_name = this.name + ".h";
		this.caps_name = this.name.toUpperCase();
		this.mock_name = `${this.name.charAt(0).toUpperCase()}${this.name.slice(1)}`;
		this.mock_instance_name = `${this.mock_name.charAt(0).toLowerCase()}${this.mock_name.slice(1)}_mock_`;
		this.mock_name += "_Mock";
		this.caps_mock_name = `${this.caps_name}_MOCK`;
		this.caps_stub_name = `${this.caps_name}_STUB`;

		this.output_path = this.config.get('outputPath') || "";
		this.workspace_folder = workspace_folder;
		this.template_path = template_path;

		if (this.output_path.includes("${workspaceFolder}")) {
			if (this.workspace_folder === "") {
				console.log("Not in a workspace, files will be put in the input file folder.")
				this.output_path = "";
			}
			else {
				this.output_path = this.output_path.replace("${workspaceFolder}", this.workspace_folder);
			}
		}

		let RegexParserConfig = {
			skip_functions_with_implicit_return_type: this.config.get('skipFunctionsWithImplicitReturnType'),
			skip_static_functions: this.config.get('skipStaticFunctions'),
			skip_extern_functions: this.config.get('skipExternFunctions'),
			ignored_function_names: this.ignored_function_names,
		};

		this.regexParser = new RegexParser(RegexParserConfig, this.c_functions_strings);

		console.log(`Output path: ${this.output_path}`);
	}

	// TODO: refactor this function by crate a function generate, which takes  fn as argument
	public mock(): GenerationResult {

		// Skip generation if double mocking is disabled and input file name contains '_mock' before extension
		if (this.config.disableDoubleMocking) {
			const fileName = this.filename;
			const dotIndex = fileName.lastIndexOf('.');
			const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
			if (/_mock$/i.test(baseName)) {
				return {
					result: 1,
					message: "Skipping generation: double mocking is disabled and file name contains '_mock'.",
					mock_count: 0,
				};
			}
		}

		if ("file" === this.uri.scheme) {
			const mock_strings_list = this.regexParser.getFunctionStrings((fn: FunctionInfo) => 
				`\tMOCK_METHOD(${fn.returnType}, ${fn.name}, (${fn.arguments}));`, RegexParserToolbox.removeArgumentName_ProcessArguments
			);
			const mock_strings = mock_strings_list.join("\n");
			const impl_strings = this.getMockImplStrings().join("\n");
			// var decl_strings = this.regexParser.getFunctionStrings(RegexParserToolbox.defaultStringifyFunction).join("\n");
			console.log("mock strings:");
			console.log(mock_strings);
			this.generateMockFiles(mock_strings, impl_strings);
			if (mock_strings_list.length > 0) {
				return {
					result: 0,
					message: `${mock_strings_list.length} mocks written to:\n${this.file_written} (.cc)`,
					mock_count: mock_strings_list.length,
				};
			}
			else{
				return {
					result: 2,
					message: "Error while generating mock file content.",
					mock_count: 0,
				};
			}
		}
		return {
			result: 3,
			message: "Error while generating: opened file is not a file on disk.",
			mock_count: 0
		};
	}

	// TODO: refactor this function by crate a function generate, which takes  fn as argument
	public stub(): GenerationResult {

		// Skip generation if double mocking is disabled and input file name contains '_mock' before extension
		if (this.config.disableDoubleMocking) {
			const fileName = this.filename;
			const dotIndex = fileName.lastIndexOf('.');
			const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
			if (/_stub$/i.test(baseName)) {
				return {
					result: 1,
					message: "Skipping generation: double mocking is disabled and file name contains '_stub'.",
					mock_count: 0,
				};
			}
		}

		if ("file" === this.uri.scheme) {
			const stub_strings_list = this.getStubImplStrings();
			const stub_strings = stub_strings_list.join("\n");
			console.log("stub strings:");
			console.log(stub_strings);
			this.generateStubFiles(stub_strings);
			if (stub_strings_list.length > 0) {
				return {
					result: 0,
					message: `${stub_strings_list.length} stubs written to:\n${this.file_written} (.cc)`,
					mock_count: stub_strings_list.length,
				};
			}
			else{
				return {
					result: 2,
					message: "Error while generating mock file content.",
					mock_count: 0,
				};
			}
		}
		return {
			result: 3,
			message: "Error while generating: opened file is not a file on disk.",
			mock_count: 0
		};
	}

	private generateMockFiles(mock_strings: string, impl_strings: string) {
		var header = this.generateMockHeader(mock_strings);

		var src = this.generateMockSrc(impl_strings);

		if (this.output_path && this.output_path.length > 0) {

			fs.mkdirSync(this.output_path, { recursive: true });
			let mockHeaderPath = this.output_path + '/' + this.name + '_mock.h';
			let mockSrcPath = this.output_path + '/' + this.name + '_mock.cc';
			console.log(`Writing mock files to: ${mockHeaderPath} and ${mockSrcPath}`);
			fs.writeFileSync(mockHeaderPath, header, { flag: 'w' });
			fs.writeFileSync(mockSrcPath, src, { flag: 'w' });
			this.file_written = mockHeaderPath;
		}
		else {
			fs.writeFileSync(this.defaultMockHeaderPath, header, { flag: 'w' });
			fs.writeFileSync(this.defaultMockSrcPath, src, { flag: 'w' });
			console.log(`Writing mock files to: ${this.defaultMockHeaderPath} and ${this.defaultMockSrcPath}`);
			this.file_written = this.defaultMockHeaderPath;
		}

		// console.log(header);
		// console.log(src);
	}

	private generateStubFiles(stub_strings: string) {
		var src = this.generateStubSrc(stub_strings);

		if (this.output_path && this.output_path.length > 0) {

			fs.mkdirSync(this.output_path, { recursive: true });
			let stubSrcPath = this.output_path + '/' + this.name + '_stub.cc';
			console.log(`Writing stub file to: ${stubSrcPath}`);
			fs.writeFileSync(stubSrcPath, src, { flag: 'w' });
			this.file_written = stubSrcPath;
		}
		else {
			fs.writeFileSync(this.defaultStubSrcPath, src, { flag: 'w' });
			console.log(`Writing stub files to: ${this.defaultStubSrcPath}`);
			this.file_written = this.defaultStubSrcPath;
		}

		// console.log(header);
		// console.log(src);
	}






/* === GENERATOR ZONE === */
/* TODO: refactor to another class or mixin */
	private getMockImplStrings(processArgumentsFunction: (args: string) => string = RegexParserToolbox.defaultProcessArguments): string[] {
		const mock_decl_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			/* <--- SOURCE TEMPLATE */
			`${fn.returnType} ${fn.name}(${fn.arguments})`,
			/* <--- SOURCE TEMPLATE */
		processArgumentsFunction);

/* SOURCE TEMPLATE ---> */
		const mock_call_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
`
{
	${this.caps_mock_name}_ASSERT_INSTANCE_EXISTS();
	return ${this.mock_instance_name}->${fn.name}(${fn.arguments});
}
`, RegexParserToolbox.extractArgumentName_ProcessArguments);
/* <--- END SOURCE TEMPLATE */

		// Zip mock_decl_strs with mock_call_strs
		const zipped: string[] = [];
		for (let i = 0; i < Math.min(mock_decl_strs.length, mock_call_strs.length); i++) {
			zipped.push(`${mock_decl_strs[i]}${mock_call_strs[i]}`);
		}
		return zipped;

	}

	private getStubImplStrings(processArgumentsFunction: (args: string) => string = RegexParserToolbox.removeArgumentName_ProcessArguments): string[] {
		const mock_decl_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			/* <--- SOURCE TEMPLATE */
			`${fn.returnType} ${fn.name}(${fn.arguments})`,
			/* <--- SOURCE TEMPLATE */
		processArgumentsFunction);

		const mock_call_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			{
				var return_type = fn.returnType;
				/* handle implicit return type */
				if (!return_type) {
					return_type = "int";
				}

				var return_statement = `\n\treturn static_cast<${fn.returnType}>(0);`;
				if (return_type.indexOf('*') !== -1)
				{
					return_statement = "\n\treturn nullptr;";
				}
				else if (return_type === "void")
				{
					return_statement = "";
				}
				else
				{
					/* nothing */
				}

/* SOURCE TEMPLATE ---> */
return `
{
	${this.caps_stub_name}_PRINT_INFO();${return_statement}
}
`;
/* <--- END SOURCE TEMPLATE */

			});

		// Zip mock_decl_strs with mock_call_strs
		const zipped: string[] = [];
		for (let i = 0; i < Math.min(mock_decl_strs.length, mock_call_strs.length); i++) {
			zipped.push(`${mock_decl_strs[i]}${mock_call_strs[i]}`);
		}
		return zipped;

	}

private generateMockSrc(impl_strings: string) {
	const header_type_name = "Mock";
	const header_type_name_lower = header_type_name.toLowerCase();
	const template_file_path = path.join(this.template_path, 'mock_src_template.cc');
	console.log(`Using mock src template path: ${template_file_path}`);
	let template_file_contents: string = "";
	try {
		template_file_contents = fs.readFileSync(template_file_path, "utf8");
	} catch (err) {
		console.warn(`Could not read template file '${template_file_path}': ${err}`);
		template_file_contents = "";
		return;
	}

	var instance = this;
	var interpolator = new Interpolator({
		impl_strings: impl_strings,
		header_type_name: header_type_name,
		header_type_name_lower: header_type_name_lower,
		instance: instance
	});
	return interpolator.interpolate(template_file_contents);
}

private generateMockHeader(mock_strings: string, header_type_name: string = "Mock") {
	const header_type_name_lower = header_type_name.toLowerCase();

	const template_file_path = path.join(this.template_path, 'mock_header_template.h');
	let template_file_contents: string = "";
	try {
		template_file_contents = fs.readFileSync(template_file_path, "utf8");
	} catch (err) {
		console.warn(`Could not read template file '${template_file_path}': ${err}`);
		template_file_contents = "";
		return;
	}

	var instance = this;
	var interpolator = new Interpolator({
		mock_strings: mock_strings,
		header_type_name: header_type_name,
		header_type_name_lower: header_type_name_lower,
		instance: instance
	});
	return interpolator.interpolate(template_file_contents);
}

/* SOURCE TEMPLATE ---> */
	private ascii_art =
` *  _____ ______   ________  ________  ___  __    ________
 * |\\   _ \\  _   \\|\\   __  \\|\\   ____\\|\\  \\|\\  \\ |\\   __  \\
 * \\ \\  \\\\\\__\\ \\  \\ \\  \\|\\  \\ \\  \\___|\\ \\  \\/  /|\\ \\  \\|\\  \\
 *  \\ \\  \\\\|__| \\  \\ \\  \\\\\\  \\ \\  \\    \\ \\   ___  \\ \\   __  \\
 *   \\ \\  \\    \\ \\  \\ \\  \\\\\\  \\ \\  \\____\\ \\  \\\\ \\  \\ \\  \\ \\  \\
 *    \\ \\__\\    \\ \\__\\ \\_______\\ \\_______\\ \\__\\\\ \\__\\ \\__\\ \\__\\
 *     \\|__|     \\|__|\\|_______|\\|_______|\\|__| \\|__|\\|__|\\|__|
 *                        ________  ________  ___  ________   ________
 *                       |\\   ____\\|\\   ____\\|\\  \\|\\   ___  \\|\\   __  \\
 *                       \\ \\  \\___|\\ \\  \\___|\\ \\  \\ \\  \\\\ \\  \\ \\  \\|\\  \\
 *                        \\ \\  \\    \\ \\  \\    \\ \\  \\ \\  \\\\ \\  \\ \\  \\\\\\  \\
 *                         \\ \\  \\____\\ \\  \\____\\ \\  \\ \\  \\\\ \\  \\ \\  \\\\\\  \\
 *                          \\ \\_______\\ \\_______\\ \\__\\ \\__\\\\ \\__\\ \\_______\\
 *                           \\|_______|\\|_______|\\|__|\\|__| \\|__|\\|_______|
 *                              by SelerLabs`;
/* <--- END SOURCE TEMPLATE */

private generateStubSrc(stub_strings: string) {
	const header_type_name = "Stub";
	const header_type_name_lower = header_type_name.toLowerCase();
	console.log(`Using stub src template path: ${this.template_path}`);

	const template_file_path = path.join(this.template_path, 'stub_src_template.cc');
	let template_file_contents: string = "";
	try {
		template_file_contents = fs.readFileSync(template_file_path, "utf8");
	} catch (err) {
		console.warn(`Could not read template file '${template_file_path}': ${err}`);
		template_file_contents = "";
		throw err;
	}

	var instance = this;
	var interpolator = new Interpolator({
		stub_strings: stub_strings,
		header_type_name: header_type_name,
		header_type_name_lower: header_type_name_lower,
		instance: instance
	});
	return interpolator.interpolate(template_file_contents);
}

}


if(typeof module === "object")
{
    module.exports = Mockaccino;
}
