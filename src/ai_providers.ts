import * as vscode from 'vscode';

var ClaudeCliCompletion = require("./claude_cli");
var McpTools = require("./mcp_tools");

/* The AI model-source providers, and the logic that builds a fallback chain from
   the user's preferred order. Shared by the command path (extension.ts) and the
   MCP server (mcp_server.ts) — the only difference is whether a `sampling`
   provider is supplied (MCP) or not (commands). vscode-coupled (uses vscode.lm),
   so the pure chaining lives in mcp_tools.chainCompletions. */

// Borrow the editor's chat model (in practice Copilot). Throws if none, so the
// chain can fall back.
export async function vscodeLmComplete(prompt: string): Promise<string> {
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

type CompleteFn = (prompt: string) => Promise<string>;

/* Build the AI `complete` provider, preferred source first then fall back through
   the rest. `samplingComplete` is supplied only in the MCP context (the calling
   client's model); when absent, the `sampling` source is simply dropped. */
export function buildAiComplete(config: any, samplingComplete?: CompleteFn): { complete: CompleteFn; usedSource: () => string } {
	const preferred: string = config.get('ai.preferredModelSource') || 'sampling';
	const claude = new ClaudeCliCompletion(config.get('ai.claudePath') || '', config.get('ai.claudeArgs') || []);

	const available: Record<string, CompleteFn | undefined> = {
		sampling: samplingComplete,
		claudeCli: claude.complete,
		vscodeLm: vscodeLmComplete,
	};

	const order = [preferred, 'sampling', 'claudeCli', 'vscodeLm'].filter((s, i, a) => a.indexOf(s) === i);
	const providers = order
		.filter((source) => typeof available[source] === 'function')
		.map((source) => ({ source, complete: available[source] as CompleteFn }));

	return McpTools.chainCompletions(providers);
}
