var preprocessor = require("./preprocessor.ts");
var parse = require("./cparse.js");

class Mockachino {
	private content_raw: string;
	private content: string;
	private uri: vscode.Uri;

	constructor(content: string, uri: vscode.Uri) {
		this.content_raw = content;
		this.uri = uri;
		this.content = preprocessor.preprocess(this.content_raw);
	}

	public mock() {
		const ast: any[] = parse(this.content);
		const ast_string = JSON.stringify(ast, null, 2);
		console.log(`AST:\n${ast_string}`);
		if ("file" === this.uri.scheme) {
			const path = this.uri.fsPath;
			const extIndex = path.lastIndexOf('.');
			const mockPath = extIndex !== -1
				? path.slice(0, extIndex) + '_mock' + path.slice(extIndex)
				: path + '_mock';
			const functionDeclarations = Array.isArray(ast)
				? ast.filter((node: any) => node.type === "FunctionDeclaration")
				: [];
			console.log(`FunctionDeclarations:\n${JSON.stringify(functionDeclarations, null, 2)}`);
			const mappedFunctions = functionDeclarations.map((fn: any) => ({
				returnType: fn.defType?.modifier
					? Mockachino.parseArgs(fn.defType)
					: fn.defType?.name,
				name: fn.name,
				arguments: Mockachino.parseArgs(fn.arguments)
			}));
			const mappedFunctionsStrings = mappedFunctions.map((fn: any) => (
                `${fn.returnType} ${fn.name}(${fn.arguments})`
            ));

			console.log(`Mapped functions:\n${JSON.stringify(mappedFunctions, null, 1)}`);
            console.log(`Mapped function strings:\n${mappedFunctionsStrings}`);
		}
	}

	static parseArgs(args: any): string {
		// var arg = args[0];
		function parseArg(arg: any): string {
			const modifiers = arg?.modifier?.length ? arg.modifier.join(' ') + ' ' : '';
			if (arg?.type === "PointerType") {
				const targetStr = Mockachino.parseArgs(arg.target);
				return `${modifiers}*${targetStr}`;
			}
			if (arg?.type === "Type") {
				return `${modifiers}${arg.name}`;
			}
			if (arg?.type === "Definition") {
				if (arg.defType){
                    return Mockachino.parseArgs(arg.defType) + (arg.name ? " " + arg.name : "");
				}
			}
			return '';
		}
		return Array.isArray(args)? args.map((arg) => parseArg(arg)).join(", ") : parseArg(args);
	}
}

if(typeof module === "object")
{
    module.exports = Mockachino;
}
