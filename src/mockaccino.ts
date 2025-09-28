var preprocessor = require("./preprocessor.ts");
var parse = require("./cparse.js");

class Mockaccino {
	private content_raw: string;
	private content: string;
	private name: string;
	private path: string;
	private mockHeaderPath: string;
	private mockSrcPath: string;
	private uri: vscode.Uri;

	constructor(content: string, uri: vscode.Uri) {
		this.content_raw = content;
		this.uri = uri;
		this.content = preprocessor.preprocess(this.content_raw);

		this.path = this.uri.fsPath;
		const extIndex = this.path.lastIndexOf('.');
		this.mockHeaderPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_mock' + ".h"
			: this.path + '_mock';
		this.mockSrcPath = extIndex !== -1
			? this.path.slice(0, extIndex) + '_mock' + ".c"
			: this.path + '_mock';

		const pathParts = this.path.split(/[\\/]/);
		this.name = pathParts[pathParts.length - 1];

	}

	public mock() {
		if ("file" === this.uri.scheme) {
			console.log(this.getFunctionStrings());
		}
	}

	private getFunctionStrings(stringifyFunction: (fn: any) => string = Mockaccino.defaultStringifyFunction): string[] {
		const ast: any[] = parse(this.content);
		const ast_string = JSON.stringify(ast, null, 2);
		console.log(`AST:\n${ast_string}`);

		const functionDeclarations = Array.isArray(ast)
			? ast.filter((node: any) => node.type === "FunctionDeclaration")
			: [];
		console.log(`FunctionDeclarations:\n${JSON.stringify(functionDeclarations, null, 2)}`);
		const mappedFunctions = functionDeclarations.map((fn: any) => ({
			returnType: fn.defType?.modifier
				? Mockaccino.parseArgs(fn.defType)
				: fn.defType?.name,
			name: fn.name,
			arguments: Mockaccino.parseArgs(fn.arguments)
		}));
		const mappedFunctionsStrings = mappedFunctions.map(stringifyFunction);

		console.log(`Mapped functions:\n${JSON.stringify(mappedFunctions, null, 1)}`);
		return mappedFunctionsStrings;
	}

	static defaultStringifyFunction(fn: any): string {
		return `${fn.returnType} ${fn.name}(${fn.arguments})`;
	}


	static parseArgs(args: any, includeName: boolean = true): string {
		function parseArg(arg: any): string {
			const modifiers = arg?.modifier?.length ? arg.modifier.join(' ') + ' ' : '';
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
}

if(typeof module === "object")
{
    module.exports = Mockaccino;
}
