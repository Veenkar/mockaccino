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
		modelSourceNotes?: string[];
	},
	readFile: (p: string) => string = (p) => mcpFs.readFileSync(p, 'utf8'),
): string {
	const lines: string[] = [];
	const via = opts.modelSource ? ` (model source: ${opts.modelSource})` : '';
	lines.push(`Generated ${opts.count} ${opts.operation}(s) with the ${opts.backend} backend${via}.`);
	for (const note of opts.modelSourceNotes || []) {
		lines.push(`  higher-priority source skipped — ${note}`);
	}
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
	failedAttempts: () => { source: string; error: string }[];
} {
	let used = '';
	let failed: { source: string; error: string }[] = [];
	const complete = async (prompt: string): Promise<string> => {
		const errors: string[] = [];
		failed = [];
		for (const provider of providers) {
			try {
				const result = await provider.complete(prompt);
				used = provider.source;
				return result;
			} catch (err: any) {
				const message = err && err.message ? err.message : String(err);
				errors.push(`${provider.source}: ${message}`);
				failed.push({ source: provider.source, error: message });
			}
		}
		throw new Error(`all AI model sources failed —\n${errors.join('\n')}`);
	};
	return { complete, usedSource: () => used, failedAttempts: () => failed };
}

/* Explain why the winning model source isn't a higher-priority one: for each source
   ranked above `used` in `order`, report whether it was excluded up front (a reason
   in `excludedReasons`, e.g. disabled by setting or unavailable in this context) or
   was tried and failed (`failedAttempts`). Sources ranked below the winner are
   irrelevant and omitted. Pure — used by both the command log and the MCP report. */
function describeModelSelection(
	order: string[],
	used: string,
	excludedReasons: Record<string, string>,
	failedAttempts: { source: string; error: string }[],
): string[] {
	const notes: string[] = [];
	for (const source of order) {
		if (source === used) {
			break;
		}
		if (excludedReasons && excludedReasons[source]) {
			notes.push(`${source}: ${excludedReasons[source]}`);
		}
		const failure = (failedAttempts || []).find((f) => f.source === source);
		if (failure) {
			notes.push(`${source}: failed — ${failure.error}`);
		}
	}
	return notes;
}

if (typeof module === "object") {
	module.exports = { allowedBackends, stripComments, buildReport, chainCompletions, describeModelSelection };
}
