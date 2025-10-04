var Preprocessor = require("./preprocessor.ts");
var parse = require("./cparse.js");
const fs = require('fs');

interface FunctionInfo {
	returnType: string | undefined;
	name: string;
	arguments: string;
}

class Mockaccino {
	private config: any;
	private parse_method: "AST" | "REGEX";
	private content_raw: string;
	private content: string;
	private name: string;
	private caps_name: string;
	private filename: string;
	private header_name: string;
	private path: string;
	private mockHeaderPath: string;
	private mockSrcPath: string;
	private uri: any;
	private mock_name: string;
	private mock_instance_name: string;
	private c_functions_strings: string[] = [];
 	private initial_comment_text: string;
    private copyright: string;
	private version: string;

	constructor(content: string, uri: any, config: any = {}, version: string = "") {
		this.config = config;
		this.parse_method = "REGEX";
		this.content_raw = content;
		this.uri = uri;
		this.version = version;
		const additional_preprocessor_directives = this.config.get('additionalPreprocessorDirectives');
		const currentYear = new Date().getFullYear();
		this.copyright = this.config.get('copyright')
			.replace(/\$YEAR/g, currentYear)
			.split("\n")
			.map((line: string) => ` * ${line}`)
			.join("\n");
		this.copyright = this.copyright.replace(/[ \t]+$/gm, "");

		console.log(`Add preproc: ${additional_preprocessor_directives}`);
		let preprocessor = new Preprocessor(`${additional_preprocessor_directives}\n
			${this.content_raw}`);
		this.content = preprocessor.removeComments().preprocess().removeCompoundExpressions().filterByRoundBraces();
		this.content = preprocessor.get();
		this.c_functions_strings = preprocessor.mergeWhitespace().getExpressions();
		// console.log("preproc:");
		// console.log(this.content);
		console.log("fun strings:");
		console.log(this.c_functions_strings);

		this.path = this.uri.fsPath;
		const extIndex = this.path.lastIndexOf('.');
		this.mockHeaderPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_mock' + ".h"
			: this.path + '_mock';
		this.mockSrcPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_mock' + ".cc"
			: this.path + '_mock';

		const pathParts = this.path.split(/[\\/]/);
		this.filename = pathParts[pathParts.length - 1];
		const dotIndex = this.filename.lastIndexOf('.');
		this.name = dotIndex !== -1 ? this.filename.slice(0, dotIndex) : this.filename;
		this.header_name = this.name + ".h";
		this.caps_name = this.name.toUpperCase();
		this.mock_name = `${this.name.charAt(0).toUpperCase()}${this.name.slice(1)}Mock`;
		this.mock_instance_name = `${this.mock_name.charAt(0).toLowerCase()}${this.mock_name.slice(1)}`;
        const initial_comment_text = this.getInitialCommentText();
        this.initial_comment_text = initial_comment_text;
	}

	// TODO: refactor this function by crate a function generate, which takes  fn as argument
	public mock() {
		// let processArgumentsFunction = Mockaccino.defaultProcessArguments;
		// if ("AST" === this.parse_method) {
		// 	console.log("Using AST parse method.");
		// 	processArgumentsFunction = Mockaccino.defaultProcessArguments;
		// }
		// else {
		// 	console.log("Using REGEX parse method.");
		// 	processArgumentsFunction = Mockaccino.removeArgumentName_ProcessArguments;
		// }

		if ("file" === this.uri.scheme) {
			var mock_strings = this.getFunctionStrings((fn: FunctionInfo) => 
				`\tMOCK_METHOD(${fn.returnType}, ${fn.name}, (${fn.arguments}));`, Mockaccino.removeArgumentName_ProcessArguments
			).join("\n");
			var impl_strings = this.getMockImplStrings().join("\n");
			// var decl_strings = this.getFunctionStrings(Mockaccino.defaultStringifyFunction).join("\n");
			// console.log(mock_strings);
			this.generateMockFiles(mock_strings, impl_strings);
		}
	}

	private getMockImplStrings(processArgumentsFunction: (args: string) => string = Mockaccino.defaultProcessArguments): string[] {
		const mock_decl_strs = this.getFunctionStrings((fn: FunctionInfo) =>
			/* <--- SOURCE TEMPLATE */
			`${fn.returnType} ${fn.name}(${fn.arguments})`,
			/* <--- SOURCE TEMPLATE */
		processArgumentsFunction);

		const mock_call_strs = this.getFunctionStrings((fn: FunctionInfo) =>
`
{
	${this.caps_name}_ENSURE_MOCK_INSTANCE_EXISTS();
	return ${this.mock_instance_name}_->${fn.name}(${fn.arguments});
}
`, Mockaccino.extractArgumentName_ProcessArguments);

		// Zip mock_decl_strs with mock_call_strs
		const zipped: string[] = [];
		for (let i = 0; i < Math.min(mock_decl_strs.length, mock_call_strs.length); i++) {
			zipped.push(`${mock_decl_strs[i]}${mock_call_strs[i]}`);
		}
		return zipped;

	}

	private generateMockFiles(mock_strings: string, impl_strings: string) {
		var header = this.generateMockHeader(mock_strings);

		var src = this.generateMockSrc(impl_strings);
		/* <--- SOURCE TEMPLATE */
		fs.writeFileSync(this.mockHeaderPath, header, { flag: 'w' });
		fs.writeFileSync(this.mockSrcPath, src, { flag: 'w' });
		// console.log(header);
		// console.log(src);
	}

	/**
	 * Parses a C function declaration string and returns a FunctionInfo object.
	 * Example input: "int foo(char* bar, double baz)"
	 */
	public static parseFunctionDeclaration(declaration: string): FunctionInfo {
		// Remove function link modifiers (extern, static) from the start
		const cleanedDecl = declaration.replace(/^\s*(extern|static)\s+/i, '');

		// Match optional return type (with modifiers), function name, and arguments
		const regex = /^\s*([\w\s\*\&\[\]]*?)?\s*([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*;?\s*$/;
		const match = cleanedDecl.match(regex);

		if (!match) {
			return {
				returnType: undefined,
				name: "",
				arguments: ""
			};
		}

		let [, returnType, name, args] = match;

		// Remove unwanted modifiers from returnType (keep const, volatile, etc.)
		if (returnType) {
			returnType = returnType.replace(/\b(static|extern)\b/g, '').trim();
		}

		// Handle empty arguments or 'void'
		args = args.trim();
		if (!args || args === 'void') {
			args = '';
		}

		return {
			returnType: returnType || undefined,
			name: name.trim(),
			arguments: args
		};
	}

	private getFunctionStrings(
		stringifyFunction: (fn: FunctionInfo) => string = Mockaccino.defaultStringifyFunction,
		processArgumentsFunction: (args: string) => string = Mockaccino.defaultProcessArguments
	): string[] {
		let mappedFunctionsStrings: string[] = [];
		let mappedFunctions: FunctionInfo[] = [];

		if (this.parse_method === "AST") {
			const ast: any[] = parse(this.content);
			// const ast_string = JSON.stringify(ast, null, 2);
			// console.log(`AST:\n${ast_string}`);
			const functionDeclarations = Array.isArray(ast)
				? ast.filter((node: any) => node.type === "FunctionDeclaration" || node.type === "FunctionDefinition")
				: [];
			//console.log(`FunctionDeclarations:\n${JSON.stringify(functionDeclarations, null, 2)}`);

			mappedFunctions = functionDeclarations.map((fn: any) => ({ /* use any type, because cparse.js is not annotated */
				returnType: fn.defType?.modifier
					? Mockaccino.parseArgs(fn.defType)
					: fn.defType?.name,
				name: fn.name,
				arguments: Mockaccino.parseArgs(fn.arguments)
			}));
		}
		else { /* REGEX method */
			const functionDeclarations = this.c_functions_strings;
			mappedFunctions = functionDeclarations.map((fn: string) => ({
				...Mockaccino.parseFunctionDeclaration(fn)
			}));
		}

		mappedFunctions = mappedFunctions.map(fn => ({
			returnType: fn.returnType,
			name: fn.name,
			arguments: processArgumentsFunction(fn.arguments)
		}));

		mappedFunctionsStrings = mappedFunctions.map(stringifyFunction);
		//console.log(`Mapped functions:\n${JSON.stringify(mappedFunctions, null, 1)}`);
		return mappedFunctionsStrings;
	}

	static defaultStringifyFunction(fn: FunctionInfo): string {
		return `${fn.returnType} ${fn.name}(${fn.arguments});`;
	}

	static defaultProcessArguments(args: string): string {
		// Handle empty arguments or 'void'
		args = args.trim();
		if (!args || args === 'void') {
			args = '';
		}
		return args;
	}

	/**
	 * static removeArgumentName_ProcessArguments(args: string): string,
	 * Does the same that defaultProcessArguments and additionally splits the arguments by comma character,
	 * removes argument name from each array element. Argument name is the last C identifier
	 * in each of those argument strings (which can be a string of alphanumeric characters and underscores that cannot start with a number).
	 * Only do the removal if there is at least one non-space character before the matched argument name.
	 * Ensure the regex string has proper explanation comments.
	 *
	 * Processes argument strings by removing argument names.
	 * Splits the arguments by comma, and for each argument, removes the last C identifier
	 * (alphanumeric/underscore, not starting with a number) if there is at least one non-space character before it.
	 * Example: "const char* str, int count" => "const char*, int"
	 */
	static removeArgumentName_ProcessArguments(args: string): string {
		// Handle empty arguments or 'void'
		args = Mockaccino.defaultProcessArguments(args);
		return args.split(',')
			.map(arg => {
				arg = arg.trim();
				/**
				 * Regex explanation:
				 * ^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)$
				 * - (.*\S) : Capture group 1, any characters ending with a non-space (the type part)
				 * - \s+    : At least one whitespace between type and name
				 * - ([a-zA-Z_][a-zA-Z0-9_]*) : Capture group 2, C identifier (argument name)
				 * - $      : End of string
				 */
				const match = arg.match(/^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(\[\s*\])?\s*$/);
				if (match) {
					let res = match[1]; // Return only the type part
					if (match[3]) { // If there is an array part, add it back
						res += match[3];
					}
					return res;
				}
				return arg; // If no match, return as is
			})
			.join(', ');
	}

	static extractArgumentName_ProcessArguments(args: string): string {
		// Handle empty arguments or 'void'
		args = Mockaccino.defaultProcessArguments(args);
		return args.split(',')
			.map(arg => {
				arg = arg.trim();
				/**
				 * Regex explanation:
				 * ^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)$
				 * - (.*\S) : Capture group 1, any characters ending with a non-space (the type part)
				 * - \s+    : At least one whitespace between type and name
				 * - ([a-zA-Z_][a-zA-Z0-9_]*) : Capture group 2, C identifier (argument name)
				 * - $      : End of string
				 */
				const match = arg.match(/^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(\[\s*\])?\s*$/);
				if (match) {
					let res = match[2]; // Return only the type part
					return res;
				}
				return arg; // If no match, return as is
			})
			.join(', ');
	}


	static parseArgs(args: any, includeName: boolean = true): string {
		function parseArg(arg: any): string {
			const mods = arg?.modifier?.filter((node: any) => node !== "static" && node.type !== "extern");
			const modifiers = mods?.length ? arg.modifier.join(' ') + ' ' : '';
			if (arg?.type === "PointerType") {
				const targetStr = Mockaccino.parseArgs(arg.target, includeName);
				return `${modifiers}*${targetStr}`;
			}
			if (arg?.type === "Type") {
				return includeName && arg.name ? `${modifiers}${arg.name}`: modifiers;
			}
			if (arg?.type === "Definition") {
				if (arg.defType){
					const typeStr = Mockaccino.parseArgs(arg.defType, includeName);
					return includeName && arg.name ? `${typeStr} ${arg.name}` : typeStr;
				}
			}
			return '';
		}
		return Array.isArray(args) ? args.map((arg) => parseArg(arg)).join(", ") : parseArg(args);
	}

/* === GENERATOR ZONE === */
/* TODO: refactor to another class or mixin */
private generateMockSrc(impl_strings: string) {
/* SOURCE TEMPLATE ---> */
return `${this.initial_comment_text}

/*===========================================================================*
 * Include headers
 *===========================================================================*/
#include "${this.name}_mock.h"
#include <cassert>

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define ${this.caps_name}_MOCK_MISSING_WARNING \\
	"No ${this.mock_name} instance found when calling " __FUNCTION__ \\
	". Instantiate mock first!"

#define ${this.caps_name}_MOCK_ALREADY_EXISTS_WARNING \\
	"Mock instance of ${this.mock_name} already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define ${this.caps_name}_ENSURE_MOCK_INSTANCE_EXISTS() \\
	assert(nullptr != mainMock_, ${this.caps_name}_MOCK_MISSING_WARNING)

#define ${this.caps_name}_ENSURE_NO_MOCK_INSTANCE() \\
	assert(nullptr == mainMock_, ${this.caps_name}_MOCK_ALREADY_EXISTS_WARNING)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static ${this.mock_name} * ${this.mock_instance_name}_ = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
${this.mock_name}::${this.mock_name}()
{
	${this.caps_name}_ENSURE_NO_MOCK_INSTANCE();
	${this.mock_instance_name}_ = this;
}

${this.mock_name}::~${this.mock_name}()
{
	${this.mock_instance_name}_ = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
${impl_strings}
${this.getEndCommentText()}
`;
/* <--- END SOURCE TEMPLATE */
    }

private generateMockHeader(mock_strings: string) {
/* SOURCE TEMPLATE ---> */
		return `#ifndef ${this.caps_name}_MOCK_H
#define ${this.caps_name}_MOCK_H
${this.initial_comment_text}
/*===========================================================================*
 * Include headers
 *===========================================================================*/
#include "${this.header_name}"
#include <gmock/gmock.h>
#include <gtest/gtest.h>

/*===========================================================================*
 * Mock class declaration
 *===========================================================================*/
class ${this.mock_name} {
public:
	${this.mock_name}();
	virtual ~${this.mock_name}();
${mock_strings}
};

${this.getEndCommentText()}
#endif /* ${this.caps_name}_MOCK_H */
`;
/* <--- END SOURCE TEMPLATE */

/* SOURCE TEMPLATE ---> */
    }
    private getInitialCommentText() {
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		const localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        return `/*===========================================================================*
 * ${this.name} mocks generated with:
${this.ascii_art}
 **
 * DESCRIPTION:
 * Mock code for ${this.name}.
 *
 * GENERATOR: Mockaccino
 * VERSION: v${this.version}
 * INPUT: ${this.filename}
 * TIME: ${localTime}
 *
 * COPYRIGHT:
${this.copyright}
 *
 * WARNING:
 * THIS IS AN AUTOMATICALLY GENERATED FILE.
 * Editing it manually might result in loss of changes.
 **/`;
    }
/* <--- END SOURCE TEMPLATE */

/* SOURCE TEMPLATE ---> */
	private ascii_art =
` _____ ______   ________  ________  ___  __    ________  ________  ________  ___  ________   ________
|\\   _ \\  _   \\|\\   __  \\|\\   ____\\|\\  \\|\\  \\ |\\   __  \\|\\   ____\\|\\   ____\\|\\  \\|\\   ___  \\|\\   __  \\
\\ \\  \\\\\\__\\ \\  \\ \\  \\|\\  \\ \\  \\___|\\ \\  \\/  /|\\ \\  \\|\\  \\ \\  \\___|\\ \\  \\___|\\ \\  \\ \\  \\\\ \\  \\ \\  \\|\\  \\
 \\ \\  \\\\|__| \\  \\ \\  \\\\\\  \\ \\  \\    \\ \\   ___  \\ \\   __  \\ \\  \\    \\ \\  \\    \\ \\  \\ \\  \\\\ \\  \\ \\  \\\\\\  \\
  \\ \\  \\    \\ \\  \\ \\  \\\\\\  \\ \\  \\____\\ \\  \\\\ \\  \\ \\  \\ \\  \\ \\  \\____\\ \\  \\____\\ \\  \\ \\  \\\\ \\  \\ \\  \\\\\\  \\
   \\ \\__\\    \\ \\__\\ \\_______\\ \\_______\\ \\__\\\\ \\__\\ \\__\\ \\__\\ \\_______\\ \\_______\\ \\__\\ \\__\\\\ \\__\\ \\_______\\
    \\|__|     \\|__|\\|_______|\\|_______|\\|__| \\|__|\\|__|\\|__|\\|_______|\\|_______|\\|__|\\|__| \\|__|\\|_______|
                                                                by SelerLabs[TM]`;
/* <--- END SOURCE TEMPLATE */
/* SOURCE TEMPLATE ---> */
	private getEndCommentText(): string {
		return `/*============================================================================*
 * Mock code for ${this.name}.
 * Generated with MOCKACCINO v${this.version}
 * VS Code Extension by SelerLabs[TM].
 *
 * WARNING:
 * THIS IS AN AUTOMATICALLY GENERATED FILE.
 * Editing it manually might result in loss of changes.
 *
 * The Mockaccino extension can be found at:
 * MARKETPLACE:
 * https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino
 *
 * GITHUB:
 * https://github.com/Veenkar/mockaccino
 *===========================================================================*/`;
/* <--- END SOURCE TEMPLATE */
    }

}


if(typeof module === "object")
{
    module.exports = Mockaccino;
}
