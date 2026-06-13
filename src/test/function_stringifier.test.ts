import * as assert from 'assert';

const FunctionStringifier = require('../function_stringifier');

// Shared by both backends; tested directly here (it was previously only covered
// indirectly through the regex golden files).
const s = new FunctionStringifier('FOO_MOCK', 'FOO_STUB', 'foo_mock_');

suite('FunctionStringifier.mockMethod', () => {
	test('emits a tab-indented MOCK_METHOD entry', () => {
		assert.strictEqual(s.mockMethod('int', 'foo', 'int, char'), '\tMOCK_METHOD(int, foo, (int, char));');
	});

	test('empty arg types render as ()', () => {
		assert.strictEqual(s.mockMethod('void', 'bar', ''), '\tMOCK_METHOD(void, bar, ());');
	});
});

suite('FunctionStringifier.mockImpl', () => {
	test('forwards a named signature to the mock instance', () => {
		assert.strictEqual(
			s.mockImpl('int', 'foo', 'int a, int b', 'a, b'),
			'int foo(int a, int b)\n{\n\tFOO_MOCK_ASSERT_INSTANCE_EXISTS();\n\treturn foo_mock_->foo(a, b);\n}\n',
		);
	});

	test('no-arg function still forwards correctly', () => {
		assert.strictEqual(
			s.mockImpl('void', 'bar', '', ''),
			'void bar()\n{\n\tFOO_MOCK_ASSERT_INSTANCE_EXISTS();\n\treturn foo_mock_->bar();\n}\n',
		);
	});
});

suite('FunctionStringifier.stubImpl', () => {
	test('value return casts zero', () => {
		assert.strictEqual(
			s.stubImpl('int', 'baz', 'int'),
			'int baz(int)\n{\n\tFOO_STUB_PRINT_INFO();\n\treturn static_cast<int>(0);\n}\n',
		);
	});

	test('pointer return yields nullptr', () => {
		assert.strictEqual(
			s.stubImpl('char *', 'p', ''),
			'char * p()\n{\n\tFOO_STUB_PRINT_INFO();\n\treturn nullptr;\n}\n',
		);
	});

	test('void return has no return statement', () => {
		assert.strictEqual(
			s.stubImpl('void', 'v', 'int'),
			'void v(int)\n{\n\tFOO_STUB_PRINT_INFO();\n}\n',
		);
	});

	test('const-pointer return is still a pointer (nullptr)', () => {
		assert.strictEqual(
			s.stubImpl('const char *', 'name', ''),
			'const char * name()\n{\n\tFOO_STUB_PRINT_INFO();\n\treturn nullptr;\n}\n',
		);
	});
});
