// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// Parser backends. Regex is the original, dependency-free path; clang resolves
// includes/types via a real compiler (see clang_mockaccino.ts).
var RegexMockaccino = require("./regex_mockaccino");
var ClangMockaccino = require("./clang_mockaccino");
var IncludePaths = require("./include_paths");

type Operation = 'mock' | 'stub';

// Include directories from the VS Code C/C++ configuration, for the clang
// backend. Two sources: the `C_Cpp.default.includePath` setting (read via the
// config API, JSONC-aware) and the includePath arrays in c_cpp_properties.json
// (parsed directly — that file is not exposed through the config API). The
// clang backend merges these *after* mockaccino.includeDirectories.
function gatherClangIncludeDirs(workspaceFolder: string): string[] {
	const raw: string[] = [];

	const cpp = vscode.workspace.getConfiguration('C_Cpp');
	const fromSettings = cpp.get<string[]>('default.includePath');
	if (Array.isArray(fromSettings)) {
		raw.push(...fromSettings);
	}

	if (workspaceFolder) {
		const propsPath = path.join(workspaceFolder, '.vscode', 'c_cpp_properties.json');
		raw.push(...IncludePaths.fromCCppPropertiesFile(propsPath));
	}

	return IncludePaths.normalize(raw, workspaceFolder);
}

// Shared command body: read the active editor + config, construct the chosen
// backend, run the operation, and report the result. Backend constructors may
// throw (e.g. clang missing or a parse error), so generation is guarded.
function runGeneration(context: vscode.ExtensionContext, BackendClass: any, operation: Operation) {
	const config = vscode.workspace.getConfiguration('mockaccino');

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const document = editor.document;
	const uri = document.uri;
	const content = document.getText();
	const version = context.extension.packageJSON.version;
	console.log(`Mockaccino version: ${version}`);

	let wf = "";
	if (vscode.workspace.workspaceFolders !== undefined) {
		wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
	}

	const template_path = context.asAbsolutePath(path.join('templates'));

	// Only the clang backend consumes external include dirs; gathering reads
	// config + a file, so skip it for the regex backend.
	const externalIncludeDirs = BackendClass === ClangMockaccino ? gatherClangIncludeDirs(wf) : [];

	try {
		const mockaccino = new BackendClass(content, uri, config, version, wf, template_path, externalIncludeDirs);
		const result = operation === 'mock' ? mockaccino.mock() : mockaccino.stub();
		if (result.result === 0) {
			vscode.window.showInformationMessage(`Mockaccino: ${result.message}`);
		} else if (result.result === 1) {
			vscode.window.showWarningMessage(`Mockaccino: ${result.message}`);
		} else {
			vscode.window.showErrorMessage(`Mockaccino: ${result.message}`);
		}
	} catch (err: any) {
		vscode.window.showErrorMessage(`Mockaccino: ${err && err.message ? err.message : err}`);
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Mockaccino actiaved!');

	// Each command in package.json maps to a (backend, operation) pair.
	const commands: [string, any, Operation][] = [
		['mockaccino.mockCurrentFile', RegexMockaccino, 'mock'],
		['mockaccino.stubCurrentFile', RegexMockaccino, 'stub'],
		['mockaccino.mockCurrentFileClang', ClangMockaccino, 'mock'],
		['mockaccino.stubCurrentFileClang', ClangMockaccino, 'stub'],
	];

	for (const [commandId, BackendClass, operation] of commands) {
		const disposable = vscode.commands.registerCommand(commandId, () =>
			runGeneration(context, BackendClass, operation)
		);
		context.subscriptions.push(disposable);
	}
}



// This method is called when your extension is deactivated
export function deactivate() {}
