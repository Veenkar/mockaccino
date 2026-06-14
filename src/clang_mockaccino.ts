var Mockaccino = require("./mockaccino");
var ClangParser = require("./clang_parser");
var FunctionStringifier = require("./function_stringifier");
var IncludePaths = require("./include_paths");
var StructuredHelpers = require("./structured_helpers");


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
	private external_include_dirs: string[];
	private functions: any[] | undefined;

	// clang's diagnostics from the last parse, exposed so the extension can log
	// them to its output channel. `clangHadErrors` means clang exited non-zero
	// (errors present) even though it may still have emitted a partial AST.
	public clangDiagnostics: string = '';
	public clangHadErrors: boolean = false;

	/* external_include_dirs are include directories the caller gathered from the
	   VS Code C/C++ configuration (extension.ts owns that, since it needs the
	   vscode API). They are merged *after* mockaccino.includeDirectories. */
	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string, external_include_dirs: string[] = []) {
		super(uri, config, version, workspace_folder, template_path);

		this.content = content;
		this.fsPath = uri.fsPath;
		this.workspace_folder = workspace_folder;
		this.external_include_dirs = external_include_dirs || [];

		const clangPath = this.config.get('clangPath') || 'clang';
		this.parser = new ClangParser(clangPath, this.buildCompilerArgs());
		this.stringifier = new FunctionStringifier(this.naming.caps_mock_name, this.naming.caps_stub_name, this.naming.mock_instance_name);
	}

	protected getMockMethodStrings(): string[] {
		return this.getFunctions().map((c_func_info) =>
			this.stringifier.mockMethod(c_func_info.returnType, c_func_info.name, StructuredHelpers.projectArgs(c_func_info))
		);
	}

	protected getMockImplStrings(): string[] {
		return this.getFunctions().map((c_func_info) =>
			this.stringifier.mockImpl(c_func_info.returnType, c_func_info.name, StructuredHelpers.projectArgs(c_func_info))
		);
	}

	protected getStubImplStrings(): string[] {
		return this.getFunctions().map((c_func_info) =>
			this.stringifier.stubImpl(c_func_info.returnType, c_func_info.name, StructuredHelpers.projectArgs(c_func_info))
		);
	}

	/* Parse once, then apply the same config-driven filters every structured
	   backend shares (skip static/extern, drop ignored names, dedup by name). */
	private getFunctions(): any[] {
		if (this.functions !== undefined) {
			return this.functions;
		}
		const parsed = this.parser.parse(this.content, this.fsPath);
		this.clangDiagnostics = parsed.diagnostics || '';
		this.clangHadErrors = parsed.status !== 0;

		const fns = StructuredHelpers.filterFunctions(parsed.functions, {
			skipStatic: this.config.get('skipStaticFunctions'),
			skipExtern: this.config.get('skipExternFunctions'),
			ignored: this.parseIgnoredFunctionNames(),
		});
		this.functions = fns;
		return fns;
	}

	/* -I for project includes, -isystem for system header paths, plus any verbatim
	   extra args. ${workspaceFolder} is expanded the same way outputPath is.

	   Include order matters: clang resolves each #include to the first match in
	   -I order, so a header duplicated across dirs is taken from the earliest one.
	   mockaccino.includeDirectories come first (explicit user intent), then the
	   dirs gathered from the VS Code C/C++ config; the merged list is deduped. */
	private buildCompilerArgs(): string[] {
		const args: string[] = [];
		const includeDirs = IncludePaths.normalize(
			[...this.readDirList('includeDirectories'), ...this.external_include_dirs],
			this.workspace_folder,
		);
		for (const dir of includeDirs) {
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
