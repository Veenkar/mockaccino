// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// var parser = require("node-c-parser");
var Mockaccino = require("./mockaccino.ts");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "mockaccino" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('mockaccino.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from mockaccino!');
		const config = vscode.workspace.getConfiguration('mockaccino');

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			const uri = document.uri;
			const content = document.getText();
			vscode.window.showInformationMessage('Active file content read. Length: ' + content.length);
			// console.log(`Found content:\n${content}`);

			let mockaccino = new Mockaccino(content, uri, config);
			mockaccino.mock();

		} else {
			vscode.window.showWarningMessage('No active editor found.');
		}
});

	context.subscriptions.push(disposable);
}



// This method is called when your extension is deactivated
export function deactivate() {}
