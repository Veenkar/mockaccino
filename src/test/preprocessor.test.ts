import * as assert from 'assert';

// Pure module, no vscode dependency. Required from compiled JS output.
const Preprocessor = require('../preprocessor');

suite('Preprocessor — text cleanup', () => {
	test('mergeLineEscapes joins backslash-continued lines', () => {
		assert.strictEqual(new Preprocessor('a\\\nb').mergeLineEscapes().get(), 'ab');
	});

	test('removeComments strips block and line comments', () => {
		const out = new Preprocessor('int a; /* c */\n// line\nint b;').removeComments().get();
		assert.ok(!out.includes('/*'), 'block comment marker removed');
		assert.ok(!out.includes('//'), 'line comment removed');
		assert.ok(out.includes('int a'));
		assert.ok(out.includes('int b'));
	});

	test('removeExternC unwraps extern "C" blocks', () => {
		const out = new Preprocessor('extern "C" {\nint foo(void);\n}').removeExternC().get();
		assert.ok(out.includes('int foo(void);'));
		assert.ok(!out.includes('extern'));
	});

	test('removeCompoundExpressions replaces function bodies with a semicolon', () => {
		const out = new Preprocessor('int foo(void){ return 1; }').removeCompoundExpressions().get();
		assert.strictEqual(out, 'int foo(void);');
	});

	test('mergeWhitespace collapses runs of whitespace', () => {
		assert.strictEqual(new Preprocessor('a   b\n\tc').mergeWhitespace().get(), 'a b c');
	});

	test('filterByRoundBraces keeps only parenthesised expressions', () => {
		const out = new Preprocessor('int x; int foo(void)').filterByRoundBraces().get();
		assert.strictEqual(out, 'int foo(void);\n');
	});

	test('getExpressions splits on semicolons and trims', () => {
		assert.deepStrictEqual(new Preprocessor('a; b; ').getExpressions(), ['a;', 'b;']);
	});
});

suite('Preprocessor — directives', () => {
	test('preprocess expands simple object-like macros', () => {
		const out = new Preprocessor('#define X 5\nint a = X;').preprocess().get();
		assert.strictEqual(out.trim(), 'int a = 5;');
	});

	test('preprocess expands function-like macros', () => {
		const out = new Preprocessor('#define SQ(x) ((x)*(x))\nint a = SQ(3);').preprocess().get();
		assert.strictEqual(out.trim(), 'int a = ((3)*(3));');
	});

	test('preprocess drops inactive #ifdef branches', () => {
		const out = new Preprocessor('#ifdef FOO\nint a;\n#endif\nint b;').preprocess().get();
		assert.ok(!out.includes('int a;'));
		assert.ok(out.includes('int b;'));
	});

	test('preprocess keeps active #ifndef branches', () => {
		const out = new Preprocessor('#ifndef FOO\nint a;\n#endif').preprocess().get();
		assert.ok(out.includes('int a;'));
	});

	test('removePreprocessorDirectives drops # lines', () => {
		const out = new Preprocessor('#pragma once\nint a;').removePreprocessorDirectives().get();
		assert.ok(!out.includes('#pragma'));
		assert.ok(out.includes('int a;'));
	});

	test('activateSimpleIfBlocks unwraps lonely #if/#endif', () => {
		const out = new Preprocessor('#if FOO\nint a;\n#endif').activateSimpleIfBlocks().get();
		assert.strictEqual(out, 'int a;');
	});
});

suite('Preprocessor — full extraction pipeline', () => {
	test('extracts a function prototype from a defined function', () => {
		const input = '/* doc */\nint add(int a, int b) {\n    return a + b;\n}\n';
		const p = new Preprocessor(input);
		p.removeComments().mergeLineEscapes().removeExternC();
		p.preprocess();
		p.removePreprocessorDirectives().removeCompoundExpressions().filterByRoundBraces();
		const exprs = p.mergeWhitespace().getExpressions();
		assert.ok(
			exprs.some((e: string) => e.replace(/\s+/g, ' ').includes('int add(int a, int b)')),
			`expected a prototype for add, got: ${JSON.stringify(exprs)}`
		);
	});
});
