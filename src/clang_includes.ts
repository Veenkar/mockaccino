import * as vscode from 'vscode';
import * as path from 'path';

var IncludePaths = require("./include_paths");

/* Include directories for the clang backend, gathered from the VS Code C/C++
   configuration: the `C_Cpp.default.includePath` setting (config API, JSONC-aware)
   plus the includePath arrays in c_cpp_properties.json (parsed directly). Shared by
   the command path (extension.ts) and the MCP server. The clang backend merges
   these *after* mockaccino.includeDirectories. */
export function gatherClangIncludeDirs(workspaceFolder: string): string[] {
	const raw: string[] = [];

	const cpp = vscode.workspace.getConfiguration('C_Cpp');
	const fromSettings = cpp.get<string[]>('default.includePath');
	if (Array.isArray(fromSettings)) {
		raw.push(...fromSettings);
	}

	if (workspaceFolder) {
		const propsPath = path.join(workspaceFolder, '.vscode', 'c_cpp_properties.json');
		raw.push(...IncludePaths.fromCCppPropertiesFile(propsPath));
	}

	return IncludePaths.normalize(raw, workspaceFolder);
}
