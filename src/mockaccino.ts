var preprocessor = require("./preprocessor.ts");
var parse = require("./cparse.js");
const fs = require('fs');

interface FunctionInfo {
	returnType: string | undefined;
	name: string;
	arguments: string;
}

class Mockaccino {
	private content_raw: string;
	private content: string;
	private name: string;
	private caps_name: string;
	private filename: string;
	private header_name: string;
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
			? this.path.slice(0, extIndex) + '_mock' + ".cc"
			: this.path + '_mock';

		const pathParts = this.path.split(/[\\/]/);
		this.filename = pathParts[pathParts.length - 1];
		const dotIndex = this.filename.lastIndexOf('.');
		this.name = dotIndex !== -1 ? this.filename.slice(0, dotIndex) : this.filename;
		this.header_name = this.name + ".h";
		this.caps_name = this.name.toUpperCase();
	}

	public mock() {
		if ("file" === this.uri.scheme) {
			var mock_strings = this.getFunctionStrings((fn: any) => 
				`\tMOCK_METHOD(${fn.name}, ${fn.returnType}, ${fn.arguments});`
			).join("\n");
			var decl_strings = this.getFunctionStrings().join(";\n");
			console.log(mock_strings);
			var header =
`
#ifndef ${this.caps_name}_H
#define ${this.caps_name}_H
#include "${this.header_name}"
#include <gmock/gmock.h>
#include <gtest/gtest.h>

${decl_strings}

class ${this.name}Mock {
	public:
${mock_strings}
};

#endif /* ${this.caps_name}_H */

`;
			console.log(header);
			fs.writeFileSync(this.mockHeaderPath, header, { flag: 'w' });
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

		const mappedFunctions: FunctionInfo[] = functionDeclarations.map((fn: any) => ({
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
		return `${fn.returnType} ${fn.name}(${fn.arguments});`;
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
