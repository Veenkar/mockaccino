import { defineConfig } from '@vscode/test-cli';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Mocha runs inside the Electron host, whose cwd is the downloaded VS Code
// dir — not the repo. Resolve the JUnit output to an absolute path here (in the
// launcher process, cwd = repo root) so the report lands in ./test-results.
const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// Acceptance tests run the real commands in the Electron host and do real
	// file I/O; the 2000ms mocha default is too tight on cold/slow CI runners.
	mocha: {
		timeout: 20000,
		// Emit a JUnit XML report (for CI artifacts) while keeping the spec
		// reporter's console output. Options are inlined (not a configFile)
		// because mocha-multi-reporters would resolve a relative configFile
		// against the Electron host cwd, not the repo.
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				mochaFile: join(repoRoot, 'test-results', 'vscode.xml'),
				testsuitesTitle: 'mockaccino VS Code tests',
			},
		},
	},
});
