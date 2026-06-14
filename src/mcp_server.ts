import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildAiComplete } from './ai_providers';
import { gatherClangIncludeDirs } from './clang_includes';

var RegexMockaccino = require("./regex_mockaccino");
var ClangMockaccino = require("./clang_mockaccino");
var AiMockaccino = require("./ai_mockaccino");
var McpTools = require("./mcp_tools");
const mcpServerFs = require("fs");

type Operation = 'mock' | 'stub';

/* The in-process MCP server. The extension hosts a Streamable HTTP server (stateful
   — so the server can send `sampling/createMessage` requests back to the client),
   registers it with VS Code so Copilot discovers it, and exposes the same
   mock/stub generation the command palette does, with the backend chosen per call
   and gated by settings (regex always; clang/ai per mockaccino.mcp.enable*). */

function toolResultError(message: string) {
	return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// A config view that overrides outputPath for one call (the tool's outputDir arg),
// passing everything else through. The backends read .get(...) and .disableDoubleMocking.
function withOutputDir(config: any, outputDir: string): any {
	return {
		get: (key: string) => (key === 'outputPath' ? outputDir : config.get(key)),
		disableDoubleMocking: config.disableDoubleMocking,
	};
}

// Sampling provider for the AI backend: ask the connected MCP client to run the
// model (the calling client's own model — Copilot supports this; Claude Code does not).
function makeSamplingComplete(mcp: any): (prompt: string) => Promise<string> {
	return async (prompt: string): Promise<string> => {
		const result: any = await mcp.server.createMessage({
			messages: [{ role: 'user', content: { type: 'text', text: prompt } }],
			maxTokens: 8192,
		});
		const content = result && result.content;
		if (content && content.type === 'text' && typeof content.text === 'string') {
			return content.text;
		}
		throw new Error('sampling returned no text content');
	};
}

// Run one generation for a tool call and build the report-back text.
async function generate(context: vscode.ExtensionContext, mcp: any, operation: Operation, args: { path?: string; backend: string; outputDir?: string }) {
	const config = vscode.workspace.getConfiguration('mockaccino');
	const allowed: string[] = McpTools.allowedBackends(config);
	if (!allowed.includes(args.backend)) {
		return toolResultError(`Backend '${args.backend}' is not enabled over MCP. Allowed: ${allowed.join(', ')}. Enable clang/ai via the mockaccino.mcp.enableClangBackend / enableAiBackend settings.`);
	}

	// Resolve the source: a given path (absolute or workspace-relative), else the active editor.
	let workspaceRoot = '';
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	}
	let content: string;
	let fsPath: string;
	if (args.path && args.path.trim().length > 0) {
		fsPath = path.isAbsolute(args.path) ? args.path : path.join(workspaceRoot || '.', args.path);
		try {
			content = mcpServerFs.readFileSync(fsPath, 'utf8');
		} catch (err: any) {
			return toolResultError(`Could not read '${fsPath}': ${err && err.message ? err.message : err}`);
		}
	} else {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return toolResultError('No "path" given and no active editor — open a file or pass a path.');
		}
		fsPath = editor.document.uri.fsPath;
		content = editor.document.getText();
	}

	const uri = { fsPath, scheme: 'file' };
	const version = context.extension.packageJSON.version;
	const template_path = context.asAbsolutePath(path.join('templates'));
	const cfg = args.outputDir && args.outputDir.trim().length > 0 ? withOutputDir(config, args.outputDir) : config;

	try {
		let instance: any;
		let modelSource: string | undefined;
		if (args.backend === 'clang') {
			instance = new ClangMockaccino(content, uri, cfg, version, workspaceRoot, template_path, gatherClangIncludeDirs(workspaceRoot));
		} else if (args.backend === 'ai') {
			const ai = buildAiComplete(cfg, makeSamplingComplete(mcp));
			instance = new AiMockaccino(content, uri, cfg, version, workspaceRoot, template_path, ai.complete);
			await instance.prepare();
			modelSource = ai.usedSource();
		} else {
			instance = new RegexMockaccino(content, uri, cfg, version, workspaceRoot, template_path);
		}

		const result = operation === 'mock' ? instance.mock() : instance.stub();
		if (result.result !== 0) {
			return toolResultError(`Mockaccino: ${result.message}`);
		}

		const report = McpTools.buildReport({
			operation,
			backend: args.backend,
			count: result.mock_count,
			files: instance.files_written || [],
			effectiveOutputDir: (args.outputDir || config.get('outputPath') || '') as string,
			defaultOutputDir: (config.get('outputPath') || '') as string,
			modelSource,
		});
		return { content: [{ type: 'text' as const, text: report }] };
	} catch (err: any) {
		return toolResultError(`Mockaccino generation failed: ${err && err.message ? err.message : err}`);
	}
}

// Build a fresh McpServer (one per session) with the two generation tools.
function buildMcpServer(context: vscode.ExtensionContext): any {
	const mcp = new McpServer({ name: 'mockaccino', version: String(context.extension.packageJSON.version || '0.0.0') });

	const inputSchema = {
		path: z.string().optional().describe('Path to the C source/header (absolute or workspace-relative). Omit to use the active editor.'),
		backend: z.enum(['regex', 'clang', 'ai']).describe('Parser backend. regex is always available; clang/ai must be enabled in settings.'),
		outputDir: z.string().optional().describe('Override the output directory for this call. Omit to use the configured default.'),
	};

	mcp.registerTool('mockaccino_generate_mock', {
		title: 'Mockaccino: generate a gmock mock',
		description: 'Generate a C++ gmock mock (_mock.h + _mock.cc) from a C file, using the chosen parser backend. Returns the written file paths and their key content (comments stripped).',
		inputSchema,
	}, (args: any) => generate(context, mcp, 'mock', args));

	mcp.registerTool('mockaccino_generate_stub', {
		title: 'Mockaccino: generate a stub',
		description: 'Generate a C++ stub (_stub.cc) from a C file, using the chosen parser backend. Returns the written file paths and their key content (comments stripped).',
		inputSchema,
	}, (args: any) => generate(context, mcp, 'stub', args));

	return mcp;
}

/* Start the HTTP server + register it with VS Code. Returns the URL and a dispose. */
export async function startMcpServer(context: vscode.ExtensionContext): Promise<{ dispose: () => void; url: string }> {
	const transports: Record<string, any> = {};

	const httpServer = http.createServer((req, res) => {
		void handleHttp(req, res);
	});

	async function handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		if (!req.url || !req.url.startsWith('/mcp')) {
			res.writeHead(404).end();
			return;
		}
		const sessionId = req.headers['mcp-session-id'] as string | undefined;
		try {
			if (req.method === 'POST') {
				const body = await readJsonBody(req);
				let transport = sessionId ? transports[sessionId] : undefined;
				if (!transport) {
					if (sessionId || !isInitializeRequest(body)) {
						res.writeHead(400, { 'content-type': 'application/json' }).end(
							JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session' }, id: null }),
						);
						return;
					}
					transport = new StreamableHTTPServerTransport({
						sessionIdGenerator: () => randomUUID(),
						onsessioninitialized: (sid: string) => { transports[sid] = transport; },
					});
					transport.onclose = () => { if (transport.sessionId) { delete transports[transport.sessionId]; } };
					await buildMcpServer(context).connect(transport);
				}
				await transport.handleRequest(req, res, body);
			} else if (req.method === 'GET' || req.method === 'DELETE') {
				const transport = sessionId ? transports[sessionId] : undefined;
				if (!transport) {
					res.writeHead(400).end();
					return;
				}
				await transport.handleRequest(req, res);
			} else {
				res.writeHead(405).end();
			}
		} catch {
			if (!res.headersSent) {
				res.writeHead(500).end();
			}
		}
	}

	await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
	const address = httpServer.address();
	const port = address && typeof address === 'object' ? address.port : 0;
	const url = `http://127.0.0.1:${port}/mcp`;

	const providerReg = vscode.lm.registerMcpServerDefinitionProvider('mockaccino-mcp', {
		provideMcpServerDefinitions: () => [new vscode.McpHttpServerDefinition('Mockaccino', vscode.Uri.parse(url))],
	});

	const dispose = () => {
		providerReg.dispose();
		for (const id of Object.keys(transports)) {
			try { transports[id].close(); } catch { /* ignore */ }
		}
		httpServer.close();
	};

	return { dispose, url };
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
	return new Promise((resolve, reject) => {
		let data = '';
		req.on('data', (chunk) => { data += chunk; });
		req.on('end', () => {
			if (!data) { resolve(undefined); return; }
			try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
		});
		req.on('error', reject);
	});
}
