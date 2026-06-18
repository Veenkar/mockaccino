import * as assert from 'assert';

const {
	insertInlineMocks,
	buildInlineBlock,
	findInsertionOffset,
	blankComments,
	DEFAULT_BEGIN_MARKER,
	DEFAULT_END_MARKER,
} = require('../inline_mock_inserter');

const MOCK = [
	'class app_IFoo_Mock : public app::IFoo {',
	'public:',
	'\tMOCK_METHOD(int, f, (int), (override));',
	'};',
].join('\n');

suite('inline_mock_inserter.blankComments', () => {
	test('blanks comments but keeps code and newlines, length-preserving', () => {
		const src = 'int a; // trailing\n/* block\n  comment */\nint b;\n';
		const out = blankComments(src);
		assert.strictEqual(out.length, src.length, 'length preserved');
		assert.ok(out.includes('int a;'), 'code kept');
		assert.ok(!out.includes('trailing'), 'line comment blanked');
		assert.ok(!out.includes('block'), 'block comment blanked');
		assert.strictEqual((out.match(/\n/g) || []).length, (src.match(/\n/g) || []).length, 'newlines kept');
	});

	test('does not treat // inside a string literal as a comment', () => {
		const src = 'const char* p = "http://x"; int q;';
		const out = blankComments(src);
		assert.ok(out.includes('int q;'), 'code after the string is preserved (string // ignored)');
	});
});

suite('inline_mock_inserter.buildInlineBlock', () => {
	test('wraps the classes in markers, an #ifdef guard, and the gmock include', () => {
		const block = buildInlineBlock([MOCK], 'MY_TEST', DEFAULT_BEGIN_MARKER, DEFAULT_END_MARKER, '\n');
		assert.ok(block.startsWith(DEFAULT_BEGIN_MARKER), 'starts with begin marker');
		assert.ok(block.trimEnd().endsWith(DEFAULT_END_MARKER), 'ends with end marker');
		assert.ok(block.includes('#ifdef MY_TEST'), 'opens the test guard');
		assert.ok(block.includes('#endif  // MY_TEST'), 'closes the test guard');
		assert.ok(block.includes('#include <gmock/gmock.h>'), 'pulls in gmock');
		assert.ok(block.includes('class app_IFoo_Mock'), 'contains the mock class');
	});

	test('honors the requested EOL', () => {
		const block = buildInlineBlock([MOCK], 'M', '//B', '//E', '\r\n');
		assert.ok(block.includes('\r\n'), 'uses CRLF');
		assert.ok(!/[^\r]\n/.test(block), 'no lone LF');
	});
});

suite('inline_mock_inserter.findInsertionOffset', () => {
	test('inserts before the closing include guard #endif', () => {
		const src = '#ifndef FOO_H\n#define FOO_H\nint foo(void);\n#endif // FOO_H\n';
		const off = findInsertionOffset(src);
		assert.strictEqual(src.slice(off).replace(/\s*$/, ''), '#endif // FOO_H', 'offset sits at the #endif line');
	});

	test('inserts before trailing end-of-file comments when there is no guard', () => {
		const src = 'int foo(void);\n// footer comment\n';
		const off = findInsertionOffset(src);
		assert.strictEqual(src.slice(off), '// footer comment\n', 'offset sits before the trailing comment');
	});

	test('appends at end when there is only code', () => {
		const src = 'int foo(void);\n';
		const off = findInsertionOffset(src);
		assert.strictEqual(off, src.length);
	});
});

suite('inline_mock_inserter.insertInlineMocks', () => {
	test('returns empty/unchanged when given no classes', () => {
		const res = insertInlineMocks('int x;\n', []);
		assert.strictEqual(res.status, 'empty');
		assert.strictEqual(res.changed, false);
	});

	test('inserts a guarded block inside the include guard', () => {
		const src = '#ifndef FOO_H\n#define FOO_H\nstruct IFoo { virtual int f(int) = 0; };\n#endif // FOO_H\n';
		const res = insertInlineMocks(src, [MOCK]);
		assert.strictEqual(res.status, 'inserted');
		assert.strictEqual(res.count, 1);
		// The mock block precedes the closing guard.
		assert.ok(res.content.indexOf('class app_IFoo_Mock') < res.content.lastIndexOf('#endif'), 'mock is before #endif');
		assert.ok(res.content.includes(DEFAULT_BEGIN_MARKER));
		assert.ok(res.content.includes('#ifdef MOCKACCINO_INLINE_MOCKS'));
		// Original content is preserved.
		assert.ok(res.content.includes('struct IFoo'));
	});

	test('replaces an existing marked block in place (regeneration)', () => {
		const first = insertInlineMocks('#ifndef F\n#define F\nint a;\n#endif\n', [MOCK]).content;
		const updated = 'class app_IFoo_Mock : public app::IFoo {\npublic:\n\tMOCK_METHOD(int, f, (int), (override));\n\tMOCK_METHOD(void, g, (), (override));\n};';
		const res = insertInlineMocks(first, [updated]);
		assert.strictEqual(res.status, 'replaced');
		assert.ok(res.content.includes('MOCK_METHOD(void, g'), 'picks up the new method');
		// Exactly one marked block remains.
		assert.strictEqual(res.content.split(DEFAULT_BEGIN_MARKER).length - 1, 1, 'single begin marker');
		assert.strictEqual(res.content.split(DEFAULT_END_MARKER).length - 1, 1, 'single end marker');
	});

	test('does not duplicate a class already declared elsewhere (unmarked)', () => {
		const src = '#ifndef F\n#define F\nstruct IFoo {};\nclass app_IFoo_Mock : public app::IFoo {};\n#endif\n';
		const res = insertInlineMocks(src, [MOCK]);
		assert.strictEqual(res.status, 'present');
		assert.strictEqual(res.changed, false);
		assert.strictEqual(res.content, src);
	});

	test('inserts before trailing comments in a #pragma once header (no #endif)', () => {
		const src = '#pragma once\nstruct IFoo { virtual int f(int) = 0; };\n// end of file\n';
		const res = insertInlineMocks(src, [MOCK]);
		assert.strictEqual(res.status, 'inserted');
		assert.ok(res.content.indexOf('class app_IFoo_Mock') < res.content.indexOf('// end of file'), 'mock precedes the footer comment');
		assert.ok(res.content.trimEnd().endsWith('// end of file'), 'footer comment stays last');
	});

	test('honors a custom guard macro and markers', () => {
		const res = insertInlineMocks('int a;\n', [MOCK], {
			guardMacro: 'UNDER_TEST',
			beginMarker: '/*BX*/',
			endMarker: '/*EX*/',
		});
		assert.ok(res.content.includes('/*BX*/'));
		assert.ok(res.content.includes('/*EX*/'));
		assert.ok(res.content.includes('#ifdef UNDER_TEST'));
		assert.ok(res.content.includes('#endif  // UNDER_TEST'));
	});

	test('preserves CRLF line endings', () => {
		const src = '#ifndef F\r\n#define F\r\nint a;\r\n#endif\r\n';
		const res = insertInlineMocks(src, [MOCK]);
		assert.ok(res.content.includes('\r\n'), 'still CRLF');
		assert.ok(!/[^\r]\n/.test(res.content), 'no lone LF introduced');
	});
});
