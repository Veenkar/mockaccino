import * as assert from 'assert';

const McpTools = require('../mcp_tools');

function cfg(values: any) {
	return { get: (k: string) => values[k] };
}

suite('mcp_tools.allowedBackends', () => {
	test('regex is always allowed; clang/ai only when enabled', () => {
		assert.deepStrictEqual(McpTools.allowedBackends(cfg({})), ['regex']);
		assert.deepStrictEqual(
			McpTools.allowedBackends(cfg({ 'mcp.enableClangBackend': true })),
			['regex', 'clang'],
		);
		assert.deepStrictEqual(
			McpTools.allowedBackends(cfg({ 'mcp.enableClangBackend': true, 'mcp.enableAiBackend': true })),
			['regex', 'clang', 'ai'],
		);
		assert.deepStrictEqual(
			McpTools.allowedBackends(cfg({ 'mcp.enableAiBackend': true })),
			['regex', 'ai'],
		);
	});
});

suite('mcp_tools.stripComments', () => {
	test('removes block and line comments', () => {
		const src = '/* banner */\nint foo(void);  // a function\nvoid bar(void);\n';
		const out = McpTools.stripComments(src);
		assert.ok(out.includes('int foo(void);'));
		assert.ok(out.includes('void bar(void);'));
		assert.ok(!out.includes('banner'));
		assert.ok(!out.includes('a function'));
	});

	test('collapses the blank lines left behind', () => {
		const src = '/* a */\n\n\n\nint x(void);\n';
		assert.ok(!/\n\n\n/.test(McpTools.stripComments(src)));
	});
});

suite('mcp_tools.buildReport', () => {
	const fakeRead = (p: string) => (p.endsWith('.h') ? '/* hdr */\nclass M {};\n' : '// impl\nvoid f(){}\n');

	test('reports summary, paths, output dirs, and stripped content', () => {
		const report = McpTools.buildReport({
			operation: 'mock',
			backend: 'regex',
			count: 2,
			files: ['/out/foo_mock.h', '/out/foo_mock.cc'],
			effectiveOutputDir: '/out',
			defaultOutputDir: '',
		}, fakeRead);

		assert.ok(report.includes('Generated 2 mock(s) with the regex backend.'));
		assert.ok(report.includes('/out/foo_mock.h'));
		assert.ok(report.includes('Output directory: /out'));
		assert.ok(report.includes('Configured default output directory: (next to the input file)'));
		assert.ok(report.includes('class M {};'));
		assert.ok(!report.includes('hdr'), 'header comment stripped from digest');
	});

	test('includes the model source when given (AI backend)', () => {
		const report = McpTools.buildReport({
			operation: 'stub',
			backend: 'ai',
			count: 1,
			files: ['/out/foo_stub.cc'],
			effectiveOutputDir: '/out',
			defaultOutputDir: '/out',
			modelSource: 'claudeCli',
		}, fakeRead);
		assert.ok(report.includes('with the ai backend (model source: claudeCli).'));
	});

	test('reports a read failure inline rather than throwing', () => {
		const report = McpTools.buildReport({
			operation: 'mock', backend: 'regex', count: 1,
			files: ['/missing.h'], effectiveOutputDir: '', defaultOutputDir: '',
		}, () => { throw new Error('ENOENT'); });
		assert.ok(report.includes('could not read: ENOENT'));
	});
});
