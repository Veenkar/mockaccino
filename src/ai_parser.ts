/* A function declaration extracted by the AI backend. Same structured shape as
   ClangParser's output, so it flows through the shared structured_helpers and
   FunctionStringifier exactly like the clang backend. */
interface AiFunction {
	returnType: string;
	name: string;
	params: { type: string; name: string }[];
	is_static: boolean;
	is_extern: boolean;
	is_variadic: boolean;
}

/* Parses C function declarations using a language model instead of regex/clang.
   It is deliberately *model-agnostic*: it takes an injected `complete(prompt) =>
   Promise<string>` function, so the actual model source (MCP sampling, VS Code's
   `vscode.lm`, or a future Ollama/Claude/OpenAI provider) is decided by the caller.
   The prompt-building and response-parsing are pure and unit-tested without a
   live model. */
class AiParser {
	constructor(private complete: (prompt: string) => Promise<string>) {}

	/* `input` is either the whole file or just the candidate declaration strings
	   (see the AI backend's input mode). `filename` is only used to phrase the
	   prompt. Returns the structured functions the model reported. */
	async parse(input: string, filename: string): Promise<AiFunction[]> {
		const raw = await this.complete(AiParser.buildPrompt(input, filename));
		return AiParser.extractFunctions(raw);
	}

	static buildPrompt(input: string, filename: string): string {
		return [
			`You are a C function-signature extractor. From the C code below (file "${filename}"),`,
			`extract every function that is DECLARED or DEFINED in this file itself.`,
			`Ignore functions that come from #include headers, and ignore function bodies.`,
			``,
			`Respond with ONLY a JSON array — no prose, no markdown code fences. Each element:`,
			`{"returnType": string, "name": string, "params": [{"type": string, "name": string}], "is_static": boolean, "is_extern": boolean, "is_variadic": boolean}`,
			``,
			`Rules:`,
			`- returnType: the full return type as written, e.g. "void", "int", "const char *". Default to "int" if a declaration omits it.`,
			`- params: one entry per parameter, in order. "name" may be "" when the declaration omits the parameter name. Use [] for "(void)" or an empty list.`,
			`- preserve type spelling exactly (pointers, const, struct/typedef names, arrays).`,
			`- is_variadic: true only if the parameter list ends with "...".`,
			`- is_static / is_extern: reflect the function's storage-class specifier.`,
			``,
			`C code:`,
			input,
		].join("\n");
	}

	/* Parse the model's response into structured functions. Tolerant of common
	   model output quirks — wrapping prose, ```json fences, missing fields — and
	   never throws (returns [] on anything unparseable). */
	static extractFunctions(raw: string): AiFunction[] {
		let parsed: any;
		try {
			parsed = JSON.parse(AiParser.extractJsonArray(raw));
		} catch {
			return [];
		}
		if (!Array.isArray(parsed)) {
			return [];
		}
		const out: AiFunction[] = [];
		for (const fn of parsed) {
			if (!fn || typeof fn !== "object") {
				continue;
			}
			const name = typeof fn.name === "string" ? fn.name.trim() : "";
			if (!name) {
				continue;
			}
			const params = Array.isArray(fn.params)
				? fn.params.map((p: any) => ({
					type: p && typeof p.type === "string" ? p.type.trim() : "",
					name: p && typeof p.name === "string" ? p.name.trim() : "",
				}))
				: [];
			const returnType = typeof fn.returnType === "string" && fn.returnType.trim() ? fn.returnType.trim() : "int";
			out.push({
				returnType,
				name,
				params,
				is_static: !!fn.is_static,
				is_extern: !!fn.is_extern,
				is_variadic: !!fn.is_variadic,
			});
		}
		return out;
	}

	/* Pull the JSON array out of a model response that may wrap it in prose or
	   ```json fences. Returns "[]" when no array is found. */
	static extractJsonArray(raw: string): string {
		if (typeof raw !== "string") {
			return "[]";
		}
		let text = raw.trim();
		const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
		if (fenced) {
			text = fenced[1].trim();
		}
		const start = text.indexOf("[");
		const end = text.lastIndexOf("]");
		if (start === -1 || end === -1 || end < start) {
			return "[]";
		}
		return text.slice(start, end + 1);
	}
}

if (typeof module === "object") {
	module.exports = AiParser;
}
