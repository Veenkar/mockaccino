var Mockaccino = require("./mockaccino");


/* Clang-based backend — SCAFFOLD. Parsing is not implemented yet.

   The intent: instead of the regex Preprocessor + RegexParser, drive a real C
   parser (clang) so includes and custom type modifiers are resolved properly.
   That means clang does its own preprocessing, fed the include directories this
   class gathers from the `mockaccino.includeDirectories` setting (and, later,
   possibly VS Code's C/C++ config or a compile_commands.json). The extracted
   function signatures would then feed the same template/render/write path that
   the base class already owns, so only the three generation hooks differ from
   the regex backend.

   Until that parsing exists, the hooks throw so a half-wired clang backend fails
   loudly rather than silently emitting empty mocks. extension.ts does not select
   this backend yet (regex is the only wired one). */
class ClangMockaccino extends Mockaccino {
	private content: string;
	private include_directories: string[];

	constructor(content: string, uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string) {
		super(uri, config, version, workspace_folder, template_path);

		this.content = content;
		this.include_directories = this.resolveIncludeDirectories(workspace_folder);

		console.log(`ClangMockaccino: ${this.include_directories.length} include dir(s), ` +
			`${this.content.length} bytes of source (clang parsing not yet implemented).`);
	}

	/* Include directories for clang come from the `mockaccino.includeDirectories`
	   setting, accepted as either a string[] or a comma-separated string, with
	   ${workspaceFolder} expanded the same way outputPath is. */
	private resolveIncludeDirectories(workspace_folder: string): string[] {
		const raw = this.config.get('includeDirectories');
		let dirs: string[] = [];
		if (Array.isArray(raw)) {
			dirs = raw;
		} else if (typeof raw === "string") {
			dirs = raw.split(',');
		}
		return dirs
			.map((dir: string) => dir.trim())
			.filter((dir: string) => dir.length > 0)
			.map((dir: string) => workspace_folder ? dir.replace("${workspaceFolder}", workspace_folder) : dir);
	}

	protected getMockMethodStrings(): string[] {
		return this.notImplemented();
	}

	protected getMockImplStrings(): string[] {
		return this.notImplemented();
	}

	protected getStubImplStrings(): string[] {
		return this.notImplemented();
	}

	private notImplemented(): never {
		throw new Error("ClangMockaccino: clang-based parsing is not yet implemented.");
	}
}


if(typeof module === "object")
{
    module.exports = ClangMockaccino;
}
