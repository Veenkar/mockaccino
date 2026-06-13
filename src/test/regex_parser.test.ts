import * as assert from 'assert';

// Pure module, no vscode dependency. Required from compiled JS output.
const { RegexParser, RegexParserToolbox } = require('../regex_parser');

const defaultConfig = {
	skip_functions_with_implicit_return_type: false,
	skip_static_functions: true,
	skip_extern_functions: true,
	ignored_function_names: [] as string[],
};

suite('RegexParserToolbox.parseFunctionDeclaration', () => {
	test('parses return type, name and arguments', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('int foo(char* bar, double baz)', false);
		assert.strictEqual(fn.returnType, 'int');
		assert.strictEqual(fn.name, 'foo');
		assert.strictEqual(fn.arguments, 'char* bar, double baz');
		assert.strictEqual(fn.is_static, false);
		assert.strictEqual(fn.is_extern, false);
	});

	test('treats void argument list as empty', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('void foo(void)', false);
		assert.strictEqual(fn.arguments, '');
	});

	test('parses a pointer return with the star adjacent to the name', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('const char *backend_name(void)', false);
		assert.strictEqual(fn.name, 'backend_name');
		assert.strictEqual(fn.returnType, 'const char *');
		assert.strictEqual(fn.arguments, '');
	});

	test('detects static specifier and strips it from return type', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('static int foo(void)', false);
		assert.strictEqual(fn.is_static, true);
		assert.strictEqual(fn.returnType, 'int');
	});

	test('detects extern specifier', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('extern int foo(void)', false);
		assert.strictEqual(fn.is_extern, true);
	});

	test('defaults implicit return type to int', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('foo(void)', false);
		assert.strictEqual(fn.returnType, 'int');
		assert.strictEqual(fn.name, 'foo');
	});

	test('returns empty name for unparseable input', () => {
		const fn = RegexParserToolbox.parseFunctionDeclaration('not a function', false);
		assert.strictEqual(fn.name, '');
	});
});

suite('RegexParserToolbox argument processors', () => {
	test('fixNoNameArguments names unnamed arguments', () => {
		assert.strictEqual(
			RegexParserToolbox.fixNoNameArguments('int, char*, double value'),
			'int arg1, char* arg2, double value'
		);
	});

	test('defaultProcessArguments maps void to empty', () => {
		assert.strictEqual(RegexParserToolbox.defaultProcessArguments('void'), '');
	});

	test('removeArgumentName_ProcessArguments keeps only types', () => {
		assert.strictEqual(
			RegexParserToolbox.removeArgumentName_ProcessArguments('const char* str, int count'),
			'const char*, int'
		);
	});

	test('extractArgumentName_ProcessArguments keeps only names', () => {
		assert.strictEqual(
			RegexParserToolbox.extractArgumentName_ProcessArguments('const char* str, int count'),
			'str, count'
		);
	});

	test('removeArgumentName_ProcessArguments handles a star adjacent to the name', () => {
		assert.strictEqual(
			RegexParserToolbox.removeArgumentName_ProcessArguments('const char *row, int y'),
			'const char *, int'
		);
	});

	test('extractArgumentName_ProcessArguments handles a star adjacent to the name', () => {
		assert.strictEqual(
			RegexParserToolbox.extractArgumentName_ProcessArguments('const char *row, int y'),
			'row, y'
		);
	});
});

suite('RegexParser.getFunctionStrings', () => {
	test('stringifies parsed declarations with the default callback', () => {
		const parser = new RegexParser(defaultConfig, ['int foo(int a);']);
		assert.deepStrictEqual(parser.getFunctionStrings(), ['int foo(int a);']);
	});

	test('skips static functions when configured', () => {
		const parser = new RegexParser(defaultConfig, ['static int hidden(void);', 'int shown(void);']);
		const out = parser.getFunctionStrings();
		assert.deepStrictEqual(out, ['int shown();']);
	});

	test('skips extern functions when configured', () => {
		const parser = new RegexParser(defaultConfig, ['extern int ext(void);', 'int local(void);']);
		const out = parser.getFunctionStrings();
		assert.deepStrictEqual(out, ['int local();']);
	});

	test('filters ignored function names', () => {
		const config = { ...defaultConfig, ignored_function_names: ['main'] };
		const parser = new RegexParser(config, ['int main(void);', 'int real(void);']);
		assert.deepStrictEqual(parser.getFunctionStrings(), ['int real();']);
	});

	test('deduplicates by function name', () => {
		const parser = new RegexParser(defaultConfig, ['int dup(int a);', 'int dup(int b);']);
		assert.strictEqual(parser.getFunctionStrings().length, 1);
	});

	test('applies a custom stringify callback', () => {
		const parser = new RegexParser(defaultConfig, ['int foo(int a);']);
		const out = parser.getFunctionStrings(
			(fn: any) => `MOCK_METHOD(${fn.returnType}, ${fn.name}, (${fn.arguments}));`,
			RegexParserToolbox.removeArgumentName_ProcessArguments
		);
		assert.deepStrictEqual(out, ['MOCK_METHOD(int, foo, (int));']);
	});
});
