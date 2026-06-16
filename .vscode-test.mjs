import { defineConfig } from '@vscode/test-cli';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Mocha runs inside the Electron host, whose cwd is the downloaded VS Code
// dir — not the repo. Resolve the JUnit output to an absolute path here (in the
// launcher process, cwd = repo root) so the report lands in ./test-results.
const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	// Wrapper form ({ tests, coverage }) — `coverage` is a sibling of `tests`,
	// not a per-test-config key, so it must live here to be honored.
	tests: [
		{
			// Only the tests that need the real vscode API run in the Electron
			// host (the "acceptance" suite); the pure-module tests run far faster
			// under plain mocha in `npm run test:unit`.
			files: ['out/test/acceptance.test.js', 'out/test/extension.test.js'],
			// Sources dir used to scope/remap coverage back to TypeScript.
			srcDir: 'src',
			// Acceptance tests run the real commands in the Electron host and do
			// real file I/O; the 2000ms mocha default is too tight on cold CI.
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
						mochaFile: join(repoRoot, 'tests', 'acceptance', 'report', 'results.xml'),
						testsuitesTitle: 'mockaccino acceptance tests',
					},
				},
			},
		},
	],
	// V8 coverage of the extension code exercised in the Electron host, mapped
	// back to TypeScript via source maps. Enabled with `vscode-test --coverage`;
	// the output dir is passed on the CLI (--coverage-output tests/acceptance/
	// coverage), since this version ignores a coverage.output config field.
	coverage: {
		reporter: ['text-summary', 'lcov', 'html'],
		exclude: ['**/test/**', '**/node_modules/**'],
	},
});
