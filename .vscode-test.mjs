import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// Acceptance tests run the real commands in the Electron host and do real
	// file I/O; the 2000ms mocha default is too tight on cold/slow CI runners.
	mocha: {
		timeout: 20000,
	},
});
