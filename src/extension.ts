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

// Mockaccino's own tab in the Output panel — generator progress and, crucially,
// clang's parse diagnostics are logged here so the user can read the full text
// (an error toast is truncated and transient). Created in activate().
let output: vscode.OutputChannel;

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

	output.appendLine(`[${new Date().toISOString()}] ${operation} ${uri.fsPath}`);

	try {
		const mockaccino = new BackendClass(content, uri, config, version, wf, template_path, externalIncludeDirs);
		const result = operation === 'mock' ? mockaccino.mock() : mockaccino.stub();

		// Surface clang's parse diagnostics (warnings/errors) in the output tab.
		const diagnostics: string = typeof mockaccino.clangDiagnostics === 'string' ? mockaccino.clangDiagnostics.trim() : '';
		if (diagnostics.length > 0) {
			output.appendLine('clang diagnostics:');
			output.appendLine(diagnostics);
		}

		if (mockaccino.clangHadErrors) {
			// clang reported errors; the AST may be partial, so some functions can
			// be missing or wrong. Point the user at the full log.
			output.show(true);
			vscode.window.showWarningMessage(
				'Mockaccino: clang reported errors while parsing — the generated mock may be incomplete. See the "Mockaccino" output.'
			);
			return;
		}

		if (result.result === 0) {
			output.appendLine(result.message);
			vscode.window.showInformationMessage(`Mockaccino: ${result.message}`);
		} else if (result.result === 1) {
			vscode.window.showWarningMessage(`Mockaccino: ${result.message}`);
		} else {
			output.appendLine(`ERROR: ${result.message}`);
			vscode.window.showErrorMessage(`Mockaccino: ${result.message}`);
		}
	} catch (err: any) {
		const message = err && err.message ? err.message : String(err);
		output.appendLine(`ERROR: ${message}`);
		output.show(true);
		vscode.window.showErrorMessage(`Mockaccino: generation failed — see the "Mockaccino" output. (${message.split('\n')[0]})`);
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Mockaccino actiaved!');

	output = vscode.window.createOutputChannel('Mockaccino');
	context.subscriptions.push(output);

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
