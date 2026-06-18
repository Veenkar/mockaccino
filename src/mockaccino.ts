var Naming = require("./naming");
var TemplateContext = require("./template_context");
var TemplateRenderer = require("./template_renderer");
var FileWriter = require("./file_writer");
var InlineInserter = require("./inline_mock_inserter");


interface GenerationResult {
	result: number;
	message: string;
	mock_count: number;
}

/* mockInline() does not write files itself (so the edit can be applied undoably
   in the editor), so it returns the rewritten source plus whether it changed. */
interface InlineGenerationResult extends GenerationResult {
	content: string;
	changed: boolean;
}


/* Abstract orchestrator. Owns everything that is independent of *how* the C
   source is parsed: config-derived doc metadata, naming, the template context,
   output-path resolution, and the mock()/stub() template methods that render and
   write the files. Subclasses supply the backend-specific pieces — preprocessing,
   parsing and the generated strings — by implementing the three protected hooks.

   - RegexMockaccino (regex_mockaccino.ts) is the regex-parser backend used today.
   - ClangMockaccino (clang_mockaccino.ts) is the clang-based backend (scaffold).

   Subclass constructors do their own preprocessing/parsing *after* super() runs,
   so the hooks are only ever called from mock()/stub() — never mid-construction. */
abstract class Mockaccino {
	protected config: any;
	protected uri: any;
	protected naming: any;
	protected context: typeof TemplateContext;
	protected renderer: any;
	protected writer: any;
	public file_written: string = "";
	public files_written: string[] = [];

	constructor(uri: any, config: any = {}, version: string = "", workspace_folder: string = "", template_path: string, mode: string = "") {
		this.config = config;
		this.uri = uri;

		const { localTime, copyright } = this.buildDocMetadata();
		this.naming = new Naming(this.uri.fsPath, this.config.get('mockSourceExtension'), this.config.get('mockHeaderExtension'));
		this.context = new TemplateContext(this.naming, version, localTime, copyright, mode);

		const output_path = this.resolveOutputPath(workspace_folder);
		this.renderer = new TemplateRenderer(template_path, this.context);
		this.writer = new FileWriter(output_path, this.naming);

		console.log(`Output path: ${output_path}`);
	}

	/* Backend-specific hooks. Each returns the strings the templates are filled
	   with, so the base class never needs to know which parser produced them. */
	protected abstract getMockMethodStrings(): string[];  // MOCK_METHOD(...) header entries
	protected abstract getMockImplStrings(): string[];    // mock .cc wrapper bodies
	protected abstract getStubImplStrings(): string[];    // stub .cc bodies

	/* C++ gmock mock-class blocks (one rendered `class X_Mock : public Base {…}` per
	   selected interface). Default none; backends that parse C++ classes override it.
	   Runs only from mock(), alongside the C-function output. */
	protected getCppMockClassStrings(): string[] { return []; }

	/* Shared config parsing, available to every backend. */
	protected parseIgnoredFunctionNames(): string[] {
		const ignored_function_names_string = this.config.get('ignoredFunctionNames');
		if (typeof ignored_function_names_string !== "string") {
			return [];
		}
		return ignored_function_names_string
			.split(',')
			.map((name: string) => name.trim())
			.filter((name: string) => name.length > 0);
	}

	private buildDocMetadata(): { localTime: string, copyright: string } {
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		const localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

		const currentYear = now.getFullYear();
		const copyright = this.config.get('copyright')
			.replace(/\$YEAR/g, currentYear)
			.split("\n")
			.map((line: string) => ` * ${line}`)
			.join("\n")
			.replace(/[ \t]+$/gm, "");
		return { localTime, copyright };
	}

	private resolveOutputPath(workspace_folder: string): string {
		let output_path = this.config.get('outputPath') || "";
		if (output_path.includes("${workspaceFolder}")) {
			if (workspace_folder === "") {
				console.log("Not in a workspace, files will be put in the input file folder.");
				output_path = "";
			}
			else {
				output_path = output_path.replace("${workspaceFolder}", workspace_folder);
			}
		}
		return output_path;
	}

	public mock(): GenerationResult {
		if (this.doubleGenerationBlocked('_mock')) {
			return {
				result: 1,
				message: "Skipping generation: double mocking is disabled and file name contains '_mock'.",
				mock_count: 0,
			};
		}
		if ("file" !== this.uri.scheme) {
			return this.notAFileResult();
		}

		// Everything lands in a single header (`_mock.h`): the C mock class (only
		// when there are C free functions) and the gmock C++ class mocks (only when
		// the file declares mockable C++ interfaces). The companion `.cc` is written
		// only for the C path, since the C++ class mocks are header-only.
		const mock_strings_list = this.getMockMethodStrings();   // C MOCK_METHOD entries
		const cpp_class_strings = this.getCppMockClassStrings();  // C++ mock-class blocks
		if (mock_strings_list.length === 0 && cpp_class_strings.length === 0) {
			return this.emptyContentResult();
		}

		const files: string[] = [];
		const mock_strings = mock_strings_list.join("\n");
		const mock_classes = cpp_class_strings.join("\n\n");
		console.log("mock strings:");
		console.log(mock_strings);
		console.log("mock classes:");
		console.log(mock_classes);

		const header = this.renderer.renderMockHeader(mock_strings, mock_classes);
		files.push(...this.writer.writeMockHeader(header));

		if (mock_strings_list.length > 0) {
			const src = this.renderer.renderMockSrc(this.getMockImplStrings().join("\n"));
			files.push(...this.writer.writeMockSrc(src));
		}

		this.files_written = files;
		this.file_written = files[0];

		const parts: string[] = [];
		if (mock_strings_list.length > 0) {
			parts.push(`${mock_strings_list.length} function mock(s)`);
		}
		if (cpp_class_strings.length > 0) {
			parts.push(`${cpp_class_strings.length} C++ class mock(s)`);
		}
		return {
			result: 0,
			message: `${parts.join(" and ")} written to:\n${files.join("\n")}`,
			mock_count: mock_strings_list.length + cpp_class_strings.length,
		};
	}

	/* Inline mock: render the C++ class mocks (the C free-function path doesn't
	   apply — it needs a separate .cc for the C-linkage symbols) and inject them
	   into the source itself, guarded by `#ifdef <test macro>` and wrapped in
	   markers so a re-run regenerates in place. Returns the rewritten content for
	   the caller to apply; never touches the filesystem. */
	public mockInline(source: string): InlineGenerationResult {
		if ("file" !== this.uri.scheme) {
			return { ...this.notAFileResult(), content: source, changed: false };
		}

		const cpp_class_strings = this.getCppMockClassStrings();
		if (cpp_class_strings.length === 0) {
			return {
				result: 2,
				message: "No mockable C++ interfaces found to inline (inline mocking only generates C++ class mocks).",
				mock_count: 0,
				content: source,
				changed: false,
			};
		}

		const guardMacro = this.config.get('cpp.inlineMockGuardMacro') || InlineInserter.DEFAULT_GUARD_MACRO;
		const res = InlineInserter.insertInlineMocks(source, cpp_class_strings, { guardMacro });

		if (!res.changed) {
			const message = res.status === 'present'
				? "Inline mocks already present in the file — nothing to insert."
				: "Inline mocking produced no changes.";
			return { result: 1, message, mock_count: 0, content: source, changed: false };
		}

		const verb = res.status === 'replaced' ? 'regenerated inline' : 'inserted inline';
		return {
			result: 0,
			message: `${res.count} C++ class mock(s) ${verb} in ${this.naming.filename}.`,
			mock_count: res.count,
			content: res.content,
			changed: true,
		};
	}

	public stub(): GenerationResult {
		if (this.doubleGenerationBlocked('_stub')) {
			return {
				result: 1,
				message: "Skipping generation: double mocking is disabled and file name contains '_stub'.",
				mock_count: 0,
			};
		}
		if ("file" !== this.uri.scheme) {
			return this.notAFileResult();
		}

		const stub_strings_list = this.getStubImplStrings();
		const stub_strings = stub_strings_list.join("\n");
		console.log("stub strings:");
		console.log(stub_strings);

		const src = this.renderer.renderStubSrc(stub_strings);
		this.files_written = this.writer.writeStub(src);
		this.file_written = this.files_written[0];

		if (stub_strings_list.length > 0) {
			return {
				result: 0,
				message: `${stub_strings_list.length} stubs written to:\n${this.file_written} (.cc)`,
				mock_count: stub_strings_list.length,
			};
		}
		return this.emptyContentResult();
	}

	/* When double mocking is disabled, skip inputs whose base name already ends
	   with the generated suffix (e.g. re-mocking a `*_mock.c`). */
	private doubleGenerationBlocked(suffix: string): boolean {
		if (!this.config.disableDoubleMocking) {
			return false;
		}
		const filename = this.naming.filename;
		const dotIndex = filename.lastIndexOf('.');
		const baseName = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
		return new RegExp(`${suffix}$`, 'i').test(baseName);
	}

	private notAFileResult(): GenerationResult {
		return {
			result: 3,
			message: "Error while generating: opened file is not a file on disk.",
			mock_count: 0,
		};
	}

	private emptyContentResult(): GenerationResult {
		return {
			result: 2,
			message: "Error while generating mock file content.",
			mock_count: 0,
		};
	}
}


if(typeof module === "object")
{
    module.exports = Mockaccino;
}
