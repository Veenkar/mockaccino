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
   client's model); when absent, the `sampling` source is unavailable. The `sampling`
   and `claudeCli` sources are each gated by a setting (off by default) — a disabled
   or unavailable source is dropped, and `selectionNotes()` explains why a
   lower-priority source ended up answering. */
export function buildAiComplete(config: any, samplingComplete?: CompleteFn): {
	complete: CompleteFn;
	usedSource: () => string;
	selectionNotes: () => string[];
} {
	const preferred: string = config.get('ai.preferredModelSource') || 'sampling';
	const samplingEnabled = config.get('ai.enableSampling') === true;
	const claudeCliEnabled = config.get('ai.enableClaudeCli') === true;
	const claude = new ClaudeCliCompletion(config.get('ai.claudePath') || '', config.get('ai.claudeArgs') || []);

	const order = [preferred, 'sampling', 'claudeCli', 'vscodeLm'].filter((s, i, a) => a.indexOf(s) === i);

	// Walk the priority order, building the live provider chain and recording why any
	// source was left out (disabled by setting / unavailable in this context).
	const providers: { source: string; complete: CompleteFn }[] = [];
	const excludedReasons: Record<string, string> = {};
	for (const source of order) {
		if (source === 'sampling') {
			if (!samplingEnabled) {
				excludedReasons[source] = 'disabled (set mockaccino.ai.enableSampling to use it)';
			} else if (typeof samplingComplete !== 'function') {
				excludedReasons[source] = 'unavailable here (no MCP sampling client — only offered when invoked from a sampling-capable client such as Copilot)';
			} else {
				providers.push({ source, complete: samplingComplete });
			}
		} else if (source === 'claudeCli') {
			if (!claudeCliEnabled) {
				excludedReasons[source] = 'disabled (set mockaccino.ai.enableClaudeCli to use it)';
			} else {
				providers.push({ source, complete: claude.complete });
			}
		} else {
			providers.push({ source, complete: vscodeLmComplete });
		}
	}

	const chain = McpTools.chainCompletions(providers);
	return {
		complete: chain.complete,
		usedSource: chain.usedSource,
		selectionNotes: () => McpTools.describeModelSelection(order, chain.usedSource(), excludedReasons, chain.failedAttempts()),
	};
}
