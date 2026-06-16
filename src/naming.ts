/* Value object: derives every name and default output path Mockaccino needs
   from a single input file path. Holds no behaviour beyond that derivation, so
   naming rules live in exactly one place (SRP). */
class Naming {
	readonly path: string;
	readonly filename: string;
	readonly name: string;
	readonly header_name: string;
	readonly caps_name: string;
	readonly mock_name: string;
	readonly mock_instance_name: string;
	readonly caps_mock_name: string;
	readonly caps_stub_name: string;
	readonly defaultMockHeaderPath: string;
	readonly defaultMockSrcPath: string;
	readonly defaultStubSrcPath: string;
	readonly sourceExt: string;
	readonly headerExt: string;
	readonly mock_header_name: string;
	readonly mock_header_guard: string;

	/* `sourceExt` ("cc" | "cpp") is the extension for the generated C-wrapper source
	   files (mockaccino.mockSourceExtension); `headerExt` ("h" | "hpp") is the
	   extension for the generated mock header (mockaccino.mockHeaderExtension). */
	constructor(fsPath: string, sourceExt: string = "cc", headerExt: string = "h") {
		this.path = fsPath;

		const ext = sourceExt === "cpp" ? "cpp" : "cc";
		this.sourceExt = ext;
		const hExt = headerExt === "hpp" ? "hpp" : "h";
		this.headerExt = hExt;
		const extIndex = fsPath.lastIndexOf('.');
		const base = extIndex !== -1 ? fsPath.slice(0, extIndex) : fsPath;
		this.defaultMockHeaderPath = extIndex !== -1 ? base + '_mock' + "." + hExt : fsPath + '_mock';
		this.defaultMockSrcPath = extIndex !== -1 ? base + '_mock' + "." + ext : fsPath + '_mock';
		this.defaultStubSrcPath = extIndex !== -1 ? base + '_stub' + "." + ext : fsPath + '_stub';

		const pathParts = fsPath.split(/[\\/]/);
		this.filename = pathParts[pathParts.length - 1];
		const dotIndex = this.filename.lastIndexOf('.');
		this.name = dotIndex !== -1 ? this.filename.slice(0, dotIndex) : this.filename;
		this.header_name = this.name + ".h";
		this.caps_name = this.name.toUpperCase();
		this.mock_header_name = this.name + '_mock.' + hExt;

		const pascal_name = `${this.name.charAt(0).toUpperCase()}${this.name.slice(1)}`;
		this.mock_instance_name = `${pascal_name.charAt(0).toLowerCase()}${pascal_name.slice(1)}_mock_`;
		this.mock_name = pascal_name + "_Mock";
		this.caps_mock_name = `${this.caps_name}_MOCK`;
		this.caps_stub_name = `${this.caps_name}_STUB`;
		this.mock_header_guard = `${this.caps_mock_name}_${hExt.toUpperCase()}`;
	}
}

if (typeof module === "object") {
	module.exports = Naming;
}
