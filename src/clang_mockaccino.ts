var Mockaccino = require("./mockaccino");
var ClangParser = require("./clang_parser");
var FunctionStringifier = require("./function_stringifier");


/* Clang-based backend. Drives a real clang (`-ast-dump=json`) so includes and
   custom type modifiers resolve properly, then maps the function declarations
   found in the target file to the same template/render/write path the base owns.

   Clang does its own include-resolving preprocessing, so this backend gathers
   compiler arguments from config instead of using the regex Preprocessor:
     - mockaccino.includeDirectories  -> -I<dir>     (project headers)
     - mockaccino.clangSystemHeaderPaths -> -isystem<dir>  (system headers, when
       not using clang's own matching/built-in headers)
     - mockaccino.clangExtraArgs      -> passed verbatim (e.g. -nostdinc,
       -resource-dir, -target, -std=...) — the escape hatch for header strategy.
   The clang binary is mockaccino.clangPath, or `clang` on PATH if unset.

   Parsing is memoised: the first hook that needs the functions runs clang once. */
class ClangMockaccino extends Mockaccino {
	private content: string;
	private fsPath: string;
	private parser: any;
	private stringifier: typeof FunctionStringifier;
	private workspace_folder: string;
	private functions: any[] | undefined;

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string) {
		super(uri, config, version, workspace_folder, template_path);

		this.content = content;
		this.fsPath = uri.fsPath;
		this.workspace_folder = workspace_folder;

		const clangPath = this.config.get('clangPath') || 'clang';
		this.parser = new ClangParser(clangPath, this.buildCompilerArgs());
		this.stringifier = new FunctionStringifier(this.naming.caps_mock_name, this.naming.caps_stub_name, this.naming.mock_instance_name);
	}

	protected getMockMethodStrings(): string[] {
		return this.getFunctions().map((fn) =>
			this.stringifier.mockMethod(fn.returnType, fn.name, this.typesOnly(fn))
		);
	}

	protected getMockImplStrings(): string[] {
		return this.getFunctions().map((fn) =>
			this.stringifier.mockImpl(fn.returnType, fn.name, this.signature(fn), this.callArgs(fn))
		);
	}

	protected getStubImplStrings(): string[] {
		return this.getFunctions().map((fn) =>
			this.stringifier.stubImpl(fn.returnType, fn.name, this.typesOnly(fn))
		);
	}

	/* Parse once, then apply the same config-driven filters the regex backend
	   does (skip static/extern, drop ignored names, dedup by name). */
	private getFunctions(): any[] {
		if (this.functions !== undefined) {
			return this.functions;
		}
		let fns = this.parser.parse(this.content, this.fsPath);

		if (this.config.get('skipStaticFunctions')) {
			fns = fns.filter((fn: any) => !fn.is_static);
		}
		if (this.config.get('skipExternFunctions')) {
			fns = fns.filter((fn: any) => !fn.is_extern);
		}
		const ignored = this.parseIgnoredFunctionNames();
		if (ignored.length > 0) {
			fns = fns.filter((fn: any) => !ignored.includes(fn.name));
		}
		const seen = new Set<string>();
		fns = fns.filter((fn: any) => (seen.has(fn.name) ? false : (seen.add(fn.name), true)));

		this.functions = fns;
		return fns;
	}

	/* Argument projections from the structured params. Unnamed params get a
	   synthesised name so the forwarding call and signature stay valid C. */
	private typesOnly(fn: any): string {
		const parts = fn.params.map((p: any) => p.type);
		if (fn.is_variadic) { parts.push("..."); }
		return parts.join(", ");
	}

	private signature(fn: any): string {
		const parts = fn.params.map((p: any, i: number) => `${p.type} ${p.name || `arg${i + 1}`}`);
		if (fn.is_variadic) { parts.push("..."); }
		return parts.join(", ");
	}

	private callArgs(fn: any): string {
		return fn.params.map((p: any, i: number) => p.name || `arg${i + 1}`).join(", ");
	}

	/* -I for project includes, -isystem for system header paths, plus any verbatim
	   extra args. ${workspaceFolder} is expanded the same way outputPath is. */
	private buildCompilerArgs(): string[] {
		const args: string[] = [];
		for (const dir of this.readDirList('includeDirectories')) {
			args.push('-I' + dir);
		}
		for (const dir of this.readDirList('clangSystemHeaderPaths')) {
			args.push('-isystem', dir);
		}
		const extra = this.config.get('clangExtraArgs');
		if (Array.isArray(extra)) {
			for (const a of extra) {
				if (typeof a === 'string' && a.trim().length > 0) {
					args.push(a.trim());
				}
			}
		}
		return args;
	}

	/* A setting that is either a string[] or a comma-separated string, trimmed,
	   with ${workspaceFolder} expanded. */
	private readDirList(key: string): string[] {
		const raw = this.config.get(key);
		let dirs: string[] = [];
		if (Array.isArray(raw)) {
			dirs = raw;
		} else if (typeof raw === "string") {
			dirs = raw.split(',');
		}
		return dirs
			.map((dir: string) => dir.trim())
			.filter((dir: string) => dir.length > 0)
			.map((dir: string) => this.workspace_folder ? dir.replace("${workspaceFolder}", this.workspace_folder) : dir);
	}
}


if(typeof module === "object")
{
    module.exports = ClangMockaccino;
}
