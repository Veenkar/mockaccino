var Preprocessor = require("./preprocessor");
const mcpFs = require("fs");

/* Pure helpers for the MCP server's tools (kept vscode/SDK-free so they are
   unit-testable): which backends a client may use, the comment-stripped file
   digest reported back, and the assembly of that report text. */

/* regex is always available over MCP; clang/ai are gated by settings. */
function allowedBackends(config: any): string[] {
	const allowed = ['regex'];
	if (config.get('mcp.enableClangBackend')) {
		allowed.push('clang');
	}
	if (config.get('mcp.enableAiBackend')) {
		allowed.push('ai');
	}
	return allowed;
}

/* Strip C/C++ comments (the big banner + line/block comments) so the digest sent
   back to the model is just the meaningful declarations/wrappers. Collapses the
   blank-line runs left behind. */
function stripComments(source: string): string {
	const withoutComments = new Preprocessor(source).removeComments().get();
	return withoutComments.replace(/\n[ \t]*\n([ \t]*\n)+/g, '\n\n').trim() + '\n';
}

/* Build the text the MCP tool returns to the client: a one-line summary, the
   written paths, the effective + configured-default output directories, the model
   source (for the AI backend), and each generated file with comments stripped so
   the model can act on it without a second read. `readFile` is injected for tests. */
function buildReport(
	opts: {
		operation: string;
		backend: string;
		count: number;
		files: string[];
		effectiveOutputDir: string;
		defaultOutputDir: string;
		modelSource?: string;
	},
	readFile: (p: string) => string = (p) => mcpFs.readFileSync(p, 'utf8'),
): string {
	const lines: string[] = [];
	const via = opts.modelSource ? ` (model source: ${opts.modelSource})` : '';
	lines.push(`Generated ${opts.count} ${opts.operation}(s) with the ${opts.backend} backend${via}.`);
	lines.push('');
	lines.push('Files written:');
	for (const f of opts.files) {
		lines.push(`  ${f}`);
	}
	lines.push('');
	lines.push(`Output directory: ${opts.effectiveOutputDir || '(next to the input file)'}`);
	lines.push(`Configured default output directory: ${opts.defaultOutputDir || '(next to the input file)'}`);
	for (const f of opts.files) {
		let content: string;
		try {
			content = stripComments(readFile(f));
		} catch (e: any) {
			content = `(could not read: ${e && e.message ? e.message : e})`;
		}
		lines.push('');
		lines.push(`--- ${f} (comments stripped) ---`);
		lines.push(content);
	}
	return lines.join('\n');
}

/* Try AI model-source providers in order until one succeeds; remember which one
   answered. Each provider is `{ source, complete }`. Throws (listing every
   provider's error) only when all fail. Pure — providers are injected. */
function chainCompletions(providers: { source: string; complete: (prompt: string) => Promise<string> }[]): {
	complete: (prompt: string) => Promise<string>;
	usedSource: () => string;
} {
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

if (typeof module === "object") {
	module.exports = { allowedBackends, stripComments, buildReport, chainCompletions };
}
