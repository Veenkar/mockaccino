// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { buildAiComplete } from './ai_providers';
import { gatherClangIncludeDirs } from './clang_includes';
import { startMcpServer } from './mcp_server';

// Parser backends. Regex is the original, dependency-free path; clang resolves
// includes/types via a real compiler (see clang_mockaccino.ts).
var RegexMockaccino = require("./regex_mockaccino");
var ClangMockaccino = require("./clang_mockaccino");
var AiMockaccino = require("./ai_mockaccino");

// Handle on the running MCP server (started on activate when mockaccino.mcp.enabled).
let mcpServer: { dispose: () => void; url: string } | undefined;

type Operation = 'mock' | 'stub';
type Method = 'regex' | 'clang' | 'ai';

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

// Shared command body: read the active editor + config, construct the chosen
// backend, run the operation, and report the result. Backend constructors may
// throw (e.g. clang missing or a parse error), so generation is guarded.
function runGeneration(context: vscode.ExtensionContext, BackendClass: any, operation: Operation) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}
	generate(context, BackendClass, operation, editor.document.uri, editor.document.getText());
}

// Generation core shared by the active-editor and pick-a-file commands: with the
// source already resolved to (uri, content), construct the chosen backend, run
// the operation, and report the result. Backend constructors may throw (e.g.
// clang missing or a parse error), so generation is guarded.
function generate(context: vscode.ExtensionContext, BackendClass: any, operation: Operation, uri: vscode.Uri, content: string) {
	const config = vscode.workspace.getConfiguration('mockaccino');

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

// Resolve the source for a "mock/stub a file" command: when a uri is supplied
// (invoked from the explorer context menu, or by tests) it is used directly;
// otherwise an open dialog is shown. The file is read off disk (it need not be
// open in an editor). Returns undefined on cancel or read failure (after toasting).
async function pickAndReadFile(operation: Operation, uri?: vscode.Uri): Promise<{ uri: vscode.Uri; content: string } | undefined> {
	let target = uri;
	if (!target) {
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: operation === 'mock' ? 'Mock this file' : 'Stub this file',
			title: `Mockaccino: pick a C/C++ file to ${operation}`,
			filters: { 'C/C++ sources and headers': ['c', 'h', 'hpp', 'hh', 'hxx', 'cc', 'cpp'], 'All files': ['*'] },
		});
		if (!picked || picked.length === 0) {
			return undefined; // user cancelled
		}
		target = picked[0];
	}

	try {
		const bytes = await vscode.workspace.fs.readFile(target);
		return { uri: target, content: Buffer.from(bytes).toString('utf8') };
	} catch (err: any) {
		const message = err && err.message ? err.message : String(err);
		vscode.window.showErrorMessage(`Mockaccino: could not read ${target.fsPath} — ${message}`);
		return undefined;
	}
}

// "Mock/stub a file" command body for the synchronous backends (regex/clang):
// instead of the active editor, the user points at a file. Async only to await
// the dialog/read; generation itself is synchronous.
async function runGenerationForFile(context: vscode.ExtensionContext, BackendClass: any, operation: Operation, uri?: vscode.Uri) {
	const source = await pickAndReadFile(operation, uri);
	if (!source) {
		return;
	}
	generate(context, BackendClass, operation, source.uri, source.content);
}

// The non-default parser backends (clang, AI) are exposed through a single pair
// of "(advanced)" commands rather than one command each: the user picks the
// method here. Regex is offered too so the advanced command is a strict superset
// of the default. Undefined = user cancelled the quick-pick.
async function pickMethod(): Promise<Method | undefined> {
	const items: (vscode.QuickPickItem & { method: Method })[] = [
		{ label: 'Regex', description: 'Default — no toolchain; regex-based parsing', method: 'regex' },
		{ label: 'Clang', description: 'Resolve includes/types with a real compiler (needs clang)', method: 'clang' },
		{ label: 'AI', description: 'Model-based parser (needs an AI provider)', method: 'ai' },
	];
	const picked = await vscode.window.showQuickPick(items, {
		title: 'Mockaccino: choose the parser backend',
		placeHolder: 'Parser backend',
	});
	return picked?.method;
}

// Dispatch a resolved (uri, content) to the chosen backend. Regex/clang take the
// synchronous `generate` path; AI takes the async provider path.
async function runWithMethod(context: vscode.ExtensionContext, method: Method, operation: Operation, uri: vscode.Uri, content: string) {
	if (method === 'ai') {
		await runAiGenerationOn(context, operation, uri, content);
	} else {
		generate(context, method === 'clang' ? ClangMockaccino : RegexMockaccino, operation, uri, content);
	}
}

// "Mock/stub current file (advanced)" — pick the method, then run on the editor.
async function runAdvancedCurrent(context: vscode.ExtensionContext, operation: Operation) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}
	const method = await pickMethod();
	if (!method) {
		return;
	}
	await runWithMethod(context, method, operation, editor.document.uri, editor.document.getText());
}

// "Mock/stub a file (advanced)" — pick the method, then point at a file.
async function runAdvancedFile(context: vscode.ExtensionContext, operation: Operation, uri?: vscode.Uri) {
	const method = await pickMethod();
	if (!method) {
		return;
	}
	const source = await pickAndReadFile(operation, uri);
	if (!source) {
		return;
	}
	await runWithMethod(context, method, operation, source.uri, source.content);
}

// AI generation core (used by runWithMethod): with the source resolved to (uri,
// content), build the AI provider chain, run the operation, and report the result.
// The provider chain (claude CLI / vscode.lm; the command path has no MCP client,
// so no sampling) is shared with the MCP server via ai_providers.buildAiComplete.
async function runAiGenerationOn(context: vscode.ExtensionContext, operation: Operation, uri: vscode.Uri, content: string) {
	const config = vscode.workspace.getConfiguration('mockaccino');
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
		for (const note of ai.selectionNotes()) {
			logLine(`  higher-priority source skipped — ${note}`);
		}

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

	// Default commands: the regex backend (no toolchain), on the active editor or
	// a picked file. The clang/AI backends are reached through the "(advanced)"
	// commands below, which prompt for the method.
	const commands: [string, Operation][] = [
		['mockaccino.mockCurrentFile', 'mock'],
		['mockaccino.stubCurrentFile', 'stub'],
	];
	for (const [commandId, operation] of commands) {
		context.subscriptions.push(vscode.commands.registerCommand(commandId, () =>
			runGeneration(context, RegexMockaccino, operation)
		));
	}

	// "Mock/stub a file" — point at a file via the command palette (or explorer
	// context menu) instead of the active editor. Regex backend.
	const fileCommands: [string, Operation][] = [
		['mockaccino.mockFile', 'mock'],
		['mockaccino.stubFile', 'stub'],
	];
	for (const [commandId, operation] of fileCommands) {
		context.subscriptions.push(vscode.commands.registerCommand(commandId, (uri?: vscode.Uri) =>
			runGenerationForFile(context, RegexMockaccino, operation, uri)
		));
	}

	// "(advanced)" commands — same operations, but prompt for the parser backend
	// (regex / clang / AI). Current editor and pick-a-file variants.
	const advancedCommands: [string, Operation][] = [
		['mockaccino.mockCurrentFileAdvanced', 'mock'],
		['mockaccino.stubCurrentFileAdvanced', 'stub'],
	];
	for (const [commandId, operation] of advancedCommands) {
		context.subscriptions.push(vscode.commands.registerCommand(commandId, () =>
			runAdvancedCurrent(context, operation)
		));
	}
	const advancedFileCommands: [string, Operation][] = [
		['mockaccino.mockFileAdvanced', 'mock'],
		['mockaccino.stubFileAdvanced', 'stub'],
	];
	for (const [commandId, operation] of advancedFileCommands) {
		context.subscriptions.push(vscode.commands.registerCommand(commandId, (uri?: vscode.Uri) =>
			runAdvancedFile(context, operation, uri)
		));
	}

	// Start the MCP server (unless disabled). Guarded so a failure can't break
	// activation — the rest of the extension keeps working.
	if (vscode.workspace.getConfiguration('mockaccino').get('mcp.enabled') !== false) {
		startMcpServer(context)
			.then((server) => {
				mcpServer = server;
				logLine(`MCP server listening at ${server.url} (Copilot discovers it automatically; for Claude Code run "Mockaccino: add MCP server to Claude Code").`);
			})
			.catch((err) => logLine(`MCP server failed to start: ${err && err.message ? err.message : err}`));
	}

	// Auto-write the server entry into the workspace .mcp.json so Claude Code (which
	// does not discover VS Code-contributed servers) can connect to the same server.
	context.subscriptions.push(vscode.commands.registerCommand('mockaccino.addMcpServerToClaudeCode', () =>
		addMcpServerToClaudeCode()
	));
}

// Merge a Mockaccino HTTP entry into the workspace .mcp.json (Claude Code's
// project-scoped MCP config), creating/updating it.
async function addMcpServerToClaudeCode() {
	if (!mcpServer) {
		vscode.window.showWarningMessage('Mockaccino: the MCP server is not running (enable mockaccino.mcp.enabled).');
		return;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		vscode.window.showWarningMessage('Mockaccino: open a workspace folder to write .mcp.json.');
		return;
	}
	const file = vscode.Uri.joinPath(folders[0].uri, '.mcp.json');
	let json: any = { mcpServers: {} };
	try {
		const existing = await vscode.workspace.fs.readFile(file);
		json = JSON.parse(Buffer.from(existing).toString('utf8'));
		if (!json.mcpServers || typeof json.mcpServers !== 'object') {
			json.mcpServers = {};
		}
	} catch {
		/* no existing file — start fresh */
	}
	json.mcpServers.mockaccino = { type: 'http', url: mcpServer.url };
	try {
		await vscode.workspace.fs.writeFile(file, Buffer.from(JSON.stringify(json, null, 2) + '\n', 'utf8'));
		logLine(`Wrote Mockaccino MCP entry (${mcpServer.url}) to ${file.fsPath}`);
		vscode.window.showInformationMessage('Mockaccino: added the MCP server to .mcp.json for Claude Code. Reload Claude Code to pick it up.');
	} catch (err: any) {
		vscode.window.showErrorMessage(`Mockaccino: could not write .mcp.json — ${err && err.message ? err.message : err}`);
	}
}



// This method is called when your extension is deactivated
export function deactivate() {
	if (mcpServer) {
		mcpServer.dispose();
		mcpServer = undefined;
	}
}
