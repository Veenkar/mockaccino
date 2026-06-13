import * as assert from 'assert';

const FunctionStringifier = require('../function_stringifier');

// Shared by both backends; tested directly here (it was previously only covered
// indirectly through the regex golden files).
const s = new FunctionStringifier('FOO_MOCK', 'FOO_STUB', 'foo_mock_');

// Build a ProjectedArgs bundle; only the fields a given method reads matter.
function args(types: string, signature: string = '', names: string = '') {
	return { types, signature, names };
}

suite('FunctionStringifier.mockMethod', () => {
	test('emits a tab-indented MOCK_METHOD entry (types only)', () => {
		assert.strictEqual(s.mockMethod('int', 'foo', args('int, char')), '\tMOCK_METHOD(int, foo, (int, char));');
	});

	test('empty arg types render as ()', () => {
		assert.strictEqual(s.mockMethod('void', 'bar', args('')), '\tMOCK_METHOD(void, bar, ());');
	});
});

suite('FunctionStringifier.mockImpl', () => {
	test('forwards a named signature to the mock instance', () => {
		assert.strictEqual(
			s.mockImpl('int', 'foo', args('int, int', 'int a, int b', 'a, b')),
			'int foo(int a, int b)\n{\n\tFOO_MOCK_ASSERT_INSTANCE_EXISTS();\n\treturn foo_mock_->foo(a, b);\n}\n',
		);
	});

	test('no-arg function still forwards correctly', () => {
		assert.strictEqual(
			s.mockImpl('void', 'bar', args('', '', '')),
			'void bar()\n{\n\tFOO_MOCK_ASSERT_INSTANCE_EXISTS();\n\treturn foo_mock_->bar();\n}\n',
		);
	});
});

suite('FunctionStringifier.stubImpl', () => {
	// The stub signature uses the types-only projection, never the named one.
	test('value return casts zero', () => {
		assert.strictEqual(
			s.stubImpl('int', 'baz', args('int', 'int ignored', 'ignored')),
			'int baz(int)\n{\n\tFOO_STUB_PRINT_INFO();\n\treturn static_cast<int>(0);\n}\n',
		);
	});

	test('pointer return yields nullptr', () => {
		assert.strictEqual(
			s.stubImpl('char *', 'p', args('')),
			'char * p()\n{\n\tFOO_STUB_PRINT_INFO();\n\treturn nullptr;\n}\n',
		);
	});

	test('void return has no return statement', () => {
		assert.strictEqual(
			s.stubImpl('void', 'v', args('int')),
			'void v(int)\n{\n\tFOO_STUB_PRINT_INFO();\n}\n',
		);
	});

	test('const-pointer return is still a pointer (nullptr)', () => {
		assert.strictEqual(
			s.stubImpl('const char *', 'name', args('')),
			'const char * name()\n{\n\tFOO_STUB_PRINT_INFO();\n\treturn nullptr;\n}\n',
		);
	});
});
