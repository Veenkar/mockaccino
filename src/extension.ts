// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// var parser = require("node-c-parser");
var parse = require("./cparse.js");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "mockachino" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('mockachino.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from mockachino!');

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			const uri = document.uri;
			const content = document.getText();
			vscode.window.showInformationMessage('Active file content read. Length: ' + content.length);
			console.log(`Found content:\n${content}`);

			let mockachino = new Mockachino(content, uri);
			mockachino.mock();

		} else {
			vscode.window.showWarningMessage('No active editor found.');
		}
});

	context.subscriptions.push(disposable);
}

class Mockachino {
	private content: string;
	private uri: vscode.Uri;

	constructor(content: string, uri: vscode.Uri) {
		this.content = content;
		this.uri = uri;
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
				returnType: fn.defType?.name,
				name: fn.name,
				arguments: Mockachino.parseArgs(fn.arguments)
			}));
			console.log(`Mapped functions:\n${JSON.stringify(mappedFunctions, null, 1)}`);
		}
	}

	static parseArgs(args: any): string {
		// var arg = args[0];
		function parseArg(arg: any): string {
			const modifiers = ((arg && Array.isArray(arg.modifier)) && arg.modifier.length) ? arg.modifier.join(' ')+' ' : '';
			if (arg?.type === "PointerType") {
				const targetStr = Mockachino.parseArgs(arg.target);
				return `${modifiers}*${targetStr}`;
			}
			if (arg?.type === "Type") {
				return `${modifiers}${arg.name}`;
			}
			if (arg?.type === "Definition") {
				if (arg.defType){
					return Mockachino.parseArgs(arg.defType) + " " + arg.name ;
				}
			}
			return '';
		}
		return Array.isArray(args)? args.map((arg) => parseArg(arg)).join(", ") : parseArg(args);
	}

}

// This method is called when your extension is deactivated
export function deactivate() {}
