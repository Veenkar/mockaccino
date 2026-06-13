const includePathsFs = require("fs");

/* Pure helpers for turning VS Code C/C++ include configuration into a clean list
   of -I directories. Kept free of the `vscode` API so it is unit-testable; the
   extension reads `C_Cpp.default.includePath` via the config API and hands the
   raw entries here, and this module also parses `c_cpp_properties.json` directly
   (that file is owned by the C/C++ extension and not exposed through the config
   API). Ordering is the caller's responsibility — see ClangMockaccino, which
   puts mockaccino.includeDirectories first so it wins a duplicate-header clash. */
class IncludePaths {
	/* Raw includePath entries across every configuration in a c_cpp_properties.json
	   (their union; duplicates are removed later in normalize). A missing or
	   invalid/JSONC file yields [] rather than throwing. */
	static fromCCppPropertiesFile(filePath: string): string[] {
		let text: string;
		try {
			text = includePathsFs.readFileSync(filePath, 'utf8');
		} catch {
			return [];
		}
		let json: any;
		try {
			json = JSON.parse(text);
		} catch {
			return []; // comments / trailing commas (JSONC) are not supported
		}
		const out: string[] = [];
		for (const cfg of (json.configurations || [])) {
			if (Array.isArray(cfg.includePath)) {
				out.push(...cfg.includePath);
			}
		}
		return out;
	}

	/* Clean a list of raw include entries:
	     - expand ${workspaceFolder}
	     - drop ${default} and entries with other unresolved ${...} variables
	     - strip a trailing recursive glob (`/**` or `/*`) down to its base dir,
	       since clang -I is not recursive
	     - trim and dedupe, keeping first occurrence (which preserves priority). */
	static normalize(dirs: string[], workspaceFolder: string): string[] {
		const seen = new Set<string>();
		const out: string[] = [];
		for (let dir of dirs) {
			if (typeof dir !== 'string') {
				continue;
			}
			dir = dir.trim();
			if (!dir || dir === '${default}') {
				continue;
			}
			if (workspaceFolder) {
				dir = dir.split('${workspaceFolder}').join(workspaceFolder);
			}
			dir = dir.replace(/[\\/]\*\*?$/, ''); // strip trailing /** or /*
			if (!dir || dir.includes('${')) {
				continue; // unresolved variable -> can't use it
			}
			if (!seen.has(dir)) {
				seen.add(dir);
				out.push(dir);
			}
		}
		return out;
	}
}

if (typeof module === "object") {
	module.exports = IncludePaths;
}
