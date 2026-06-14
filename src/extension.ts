// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// Parser backends. Regex is the original, dependency-free path; clang resolves
// includes/types via a real compiler (see clang_mockaccino.ts).
var RegexMockaccino = require("./regex_mockaccino");
var ClangMockaccino = require("./clang_mockaccino");
var AiMockaccino = require("./ai_mockaccino");
var ClaudeCliCompletion = require("./claude_cli");
var IncludePaths = require("./include_paths");

type Operation = 'mock' | 'stub';

// Mockaccino logs generator progress and (crucially) clang's parse diagnostics
// to two places the user can read in full — an error toast is truncated and
// transient. Both are created lazily/on activate:
//   - an Output-panel channel, and
//   - a "Mockaccino" tab in the Terminal panel (a pseudoterminal), which is more
//     discoverable than the Output dropdown.
let output: vscode.OutputChannel;
let terminal: vscode.Terminal | undefined;
let terminalWriter: vscode.EventEmitter<string> | undefined;
let terminalBuffer = '';

// Create the Mockaccino pseudoterminal on demand. Writes are buffered so the log
// history is (re)printed when the tab is first opened or reopened.
function ensureTerminal(): void {
	if (terminal) {
		return;
	}
	terminalWriter = new vscode.EventEmitter<string>();
	const pty: vscode.Pseudoterminal = {
		onDidWrite: terminalWriter.event,
		open: () => { if (terminalBuffer) { terminalWriter!.fire(terminalBuffer); } },
		close: () => { /* nothing to clean up */ },
	};
	terminal = vscode.window.createTerminal({ name: 'Mockaccino', pty });
}

// Append a line to both sinks. Terminals need CRLF.
function logLine(line: string): void {
	output.appendLine(line);
	ensureTerminal();
	const data = line.replace(/\r?\n/g, '\r\n') + '\r\n';
	terminalBuffer += data;
	terminalWriter!.fire(data);
}

// Bring the log into view (terminal tab + output channel), preserving editor focus.
function revealLog(): void {
	ensureTerminal();
	terminal!.show(true);
	output.show(true);
}

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

	logLine(`[${new Date().toISOString()}] ${operation} ${uri.fsPath}`);

	try {
		const mockaccino = new BackendClass(content, uri, config, version, wf, template_path, externalIncludeDirs);
		const result = operation === 'mock' ? mockaccino.mock() : mockaccino.stub();

		// Surface clang's parse diagnostics (warnings/errors) in the log.
		const diagnostics: string = typeof mockaccino.clangDiagnostics === 'string' ? mockaccino.clangDiagnostics.trim() : '';
		if (diagnostics.length > 0) {
			logLine('clang diagnostics:');
			logLine(diagnostics);
		}

		if (mockaccino.clangHadErrors) {
			// clang reported errors; the AST may be partial, so some functions can
			// be missing or wrong. Point the user at the full log.
			revealLog();
			vscode.window.showWarningMessage(
				'Mockaccino: clang reported errors while parsing — the generated mock may be incomplete. See the "Mockaccino" terminal/output.'
			);
			return;
		}

		if (result.result === 0) {
			logLine(result.message);
			vscode.window.showInformationMessage(`Mockaccino: ${result.message}`);
		} else if (result.result === 1) {
			logLine(result.message);
			vscode.window.showWarningMessage(`Mockaccino: ${result.message}`);
		} else {
			logLine(`ERROR: ${result.message}`);
			vscode.window.showErrorMessage(`Mockaccino: ${result.message}`);
		}
	} catch (err: any) {
		const message = err && err.message ? err.message : String(err);
		logLine(`ERROR: ${message}`);
		revealLog();
		vscode.window.showErrorMessage(`Mockaccino: generation failed — see the "Mockaccino" terminal/output. (${message.split('\n')[0]})`);
	}
}

// AI model-source provider: borrow the editor's model via vscode.lm (in practice
// Copilot). Throws if no language model is available, so the chain can fall back.
async function vscodeLmComplete(prompt: string): Promise<string> {
	const models = await vscode.lm.selectChatModels();
	if (!models || models.length === 0) {
		throw new Error('no vscode.lm chat model available (install GitHub Copilot or another language-model provider)');
	}
	const messages = [vscode.LanguageModelChatMessage.User(prompt)];
	const response = await models[0].sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
	let text = '';
	for await (const chunk of response.text) {
		text += chunk;
	}
	return text;
}

// Build the AI `complete` provider for the command-palette path: there is no MCP
// client here, so `sampling` is not available — try the `claude` CLI and vscode.lm
// in the user's preferred order, falling back through the rest, and remember which
// one actually answered.
function buildAiComplete(config: any): { complete: (prompt: string) => Promise<string>; usedSource: () => string } {
	const preferred = config.get('ai.preferredModelSource') || 'sampling';
	const order = preferred === 'vscodeLm' ? ['vscodeLm', 'claudeCli'] : ['claudeCli', 'vscodeLm'];
	const claude = new ClaudeCliCompletion(config.get('ai.claudePath') || '', config.get('ai.claudeArgs') || []);
	const providers = order.map((source) => ({
		source,
		complete: source === 'claudeCli' ? claude.complete : vscodeLmComplete,
	}));

	let used = '';
	const complete = async (prompt: string): Promise<string> => {
		const errors: string[] = [];
		for (const provider of providers) {
			try {
				const result = await provider.complete(prompt);
				used = provider.source;
				return result;
			} catch (err: any) {
				errors.push(`${provider.source}: ${err && err.message ? err.message : err}`);
			}
		}
		throw new Error(`all AI model sources failed —\n${errors.join('\n')}`);
	};
	return { complete, usedSource: () => used };
}

// The AI backend is async (the model call) and needs a `complete` provider, so it
// gets its own command body instead of the shared runGeneration.
async function runAiGeneration(context: vscode.ExtensionContext, operation: Operation) {
	const config = vscode.workspace.getConfiguration('mockaccino');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}
	const uri = editor.document.uri;
	const content = editor.document.getText();
	const version = context.extension.packageJSON.version;
	let wf = '';
	if (vscode.workspace.workspaceFolders !== undefined) {
		wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
	}
	const template_path = context.asAbsolutePath(path.join('templates'));

	logLine(`[${new Date().toISOString()}] ${operation} (ai) ${uri.fsPath}`);
	const ai = buildAiComplete(config);
	try {
		const mockaccino = new AiMockaccino(content, uri, config, version, wf, template_path, ai.complete);
		await mockaccino.prepare();
		const result = operation === 'mock' ? mockaccino.mock() : mockaccino.stub();
		logLine(`AI model source used: ${ai.usedSource() || '(none)'}`);

		if (result.result === 0) {
			logLine(result.message);
			vscode.window.showInformationMessage(`Mockaccino (AI via ${ai.usedSource()}): ${result.message}`);
		} else if (result.result === 1) {
			logLine(result.message);
			vscode.window.showWarningMessage(`Mockaccino: ${result.message}`);
		} else {
			logLine(`ERROR: ${result.message}`);
			vscode.window.showErrorMessage(`Mockaccino: ${result.message}`);
		}
	} catch (err: any) {
		const message = err && err.message ? err.message : String(err);
		logLine(`ERROR: ${message}`);
		revealLog();
		vscode.window.showErrorMessage(`Mockaccino: AI generation failed — see the "Mockaccino" terminal/output. (${message.split('\n')[0]})`);
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

	// If the user closes the Mockaccino terminal, drop the handle so the next log
	// recreates it (its buffered history is reprinted on open).
	context.subscriptions.push(vscode.window.onDidCloseTerminal((closed) => {
		if (closed === terminal) {
			terminal = undefined;
			terminalWriter = undefined;
		}
	}));

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

	// The AI backend is async with its own command body.
	const aiCommands: [string, Operation][] = [
		['mockaccino.mockCurrentFileAi', 'mock'],
		['mockaccino.stubCurrentFileAi', 'stub'],
	];
	for (const [commandId, operation] of aiCommands) {
		context.subscriptions.push(vscode.commands.registerCommand(commandId, () =>
			runAiGeneration(context, operation)
		));
	}
}



// This method is called when your extension is deactivated
export function deactivate() {}
