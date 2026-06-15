var Mockaccino = require("./mockaccino");
var AiParser = require("./ai_parser");
var FunctionStringifier = require("./function_stringifier");
var StructuredHelpers = require("./structured_helpers");
var extractDeclarations = require("./declaration_extractor");


/* AI-parser backend. Like the regex backend, but wherever the regex backend uses
   regex to extract function declarations, this asks a language model instead. The
   model source is decided by the caller via the injected `complete` function (MCP
   sampling, VS Code's vscode.lm, or a future external provider), so this class is
   model-agnostic and unit-testable with a fake `complete`.

   `mockaccino.ai.inputMode` selects what the model sees:
     - "fullFile"                 — the whole source; the model resolves types/context.
     - "declarations"  (default)  — only the candidate declaration strings the regex
                                    preprocessor extracts (cheaper, mirrors regex).
     - "declarationsWithContext"  — the candidate declarations to extract, plus the
                                    whole file as type context the model may read but
                                    must not extract from.

   The model call is async, so callers must `await prepare()` before mock()/stub()
   (the base hooks are synchronous and read the cached function list). */
class AiMockaccino extends Mockaccino {
	private content: string;
	private parser: any;
	private stringifier: typeof FunctionStringifier;
	private functions: any[] | undefined;

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string, complete: (prompt: string) => Promise<string>) {
		super(uri, config, version, workspace_folder, template_path);

		this.content = content;
		this.parser = new AiParser(complete);
		this.stringifier = new FunctionStringifier(this.naming.caps_mock_name, this.naming.caps_stub_name, this.naming.mock_instance_name);
	}

	/* Run the model once and cache the filtered function list. Idempotent. Must be
	   awaited before mock()/stub(). */
	async prepare(): Promise<void> {
		if (this.functions !== undefined) {
			return;
		}
		const { input, context } = this.buildModelInput();
		const fns = await this.parser.parse(input, this.naming.filename, context);
		this.functions = StructuredHelpers.filterFunctions(fns, {
			skipStatic: this.config.get('skipStaticFunctions'),
			skipExtern: this.config.get('skipExternFunctions'),
			ignored: this.parseIgnoredFunctionNames(),
		});
	}

	/* What to feed the model, per mockaccino.ai.inputMode: the whole file, just the
	   candidate declarations, or the declarations plus the whole file as type context. */
	private buildModelInput(): { input: string; context?: string } {
		const mode = this.config.get('ai.inputMode');
		if (mode === 'declarations' || mode === 'declarationsWithContext') {
			const directives = this.config.get('additionalPreprocessorDirectives') || '';
			const lonely = this.config.get('treatLonelyPreprocIfAsActive');
			const declarations = extractDeclarations(this.content, directives, lonely).join('\n');
			return mode === 'declarationsWithContext'
				? { input: declarations, context: this.content }
				: { input: declarations };
		}
		return { input: this.content };
	}

	protected getMockMethodStrings(): string[] {
		return this.getFunctions().map((fn) =>
			this.stringifier.mockMethod(fn.returnType, fn.name, StructuredHelpers.projectArgs(fn))
		);
	}

	protected getMockImplStrings(): string[] {
		return this.getFunctions().map((fn) =>
			this.stringifier.mockImpl(fn.returnType, fn.name, StructuredHelpers.projectArgs(fn))
		);
	}

	protected getStubImplStrings(): string[] {
		return this.getFunctions().map((fn) =>
			this.stringifier.stubImpl(fn.returnType, fn.name, StructuredHelpers.projectArgs(fn))
		);
	}

	private getFunctions(): any[] {
		if (this.functions === undefined) {
			throw new Error("AiMockaccino: call await prepare() before mock()/stub().");
		}
		return this.functions;
	}
}


if(typeof module === "object")
{
    module.exports = AiMockaccino;
}
