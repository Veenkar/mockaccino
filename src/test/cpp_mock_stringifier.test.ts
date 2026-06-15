import * as assert from 'assert';

const { stringifyMockClass, stringifyMockClasses, stringifyMockMethod, methodSpecs } = require('../cpp_mock_stringifier');

const nestedClass = {
	name: 'Inner',
	qualifiedName: 'app::Outer::Inner',
	mockClassName: 'app_Outer_Inner_Mock',
	namespaces: ['app'],
	classPath: ['Outer', 'Inner'],
	methods: [{ returnType: 'void', name: 'g', paramTypes: '', isConst: false, isNoexcept: false }],
};
const globalClass = {
	name: 'Bare',
	qualifiedName: 'Bare',
	mockClassName: 'Bare_Mock',
	namespaces: [],
	classPath: ['Bare'],
	methods: [{ returnType: 'int', name: 'v', paramTypes: '', isConst: false, isNoexcept: false }],
};

suite('cpp_mock_stringifier.methodSpecs', () => {
	test('always override; const first, noexcept last', () => {
		assert.strictEqual(methodSpecs({ isConst: false, isNoexcept: false }), 'override');
		assert.strictEqual(methodSpecs({ isConst: true, isNoexcept: false }), 'const, override');
		assert.strictEqual(methodSpecs({ isConst: true, isNoexcept: true }), 'const, override, noexcept');
		assert.strictEqual(methodSpecs({ isConst: false, isNoexcept: true }), 'override, noexcept');
	});
});

suite('cpp_mock_stringifier.stringifyMockMethod', () => {
	test('emits a tab-indented MOCK_METHOD with types-only params and specs', () => {
		const line = stringifyMockMethod({
			returnType: 'int', name: 'f', paramTypes: 'int, const char*', isConst: true, isNoexcept: false,
		});
		assert.strictEqual(line, '\tMOCK_METHOD(int, f, (int, const char*), (const, override));');
	});
});

suite('cpp_mock_stringifier.stringifyMockClass', () => {
	test('derives the flat mock class from the qualified base', () => {
		const block = stringifyMockClass({
			mockClassName: 'app_IFoo_Mock',
			qualifiedName: 'app::IFoo',
			methods: [
				{ returnType: 'int', name: 'f', paramTypes: 'int', isConst: true, isNoexcept: false },
				{ returnType: 'void', name: 'reset', paramTypes: '', isConst: false, isNoexcept: false },
			],
		});
		assert.strictEqual(block, [
			'class app_IFoo_Mock : public app::IFoo {',
			'public:',
			'\tMOCK_METHOD(int, f, (int), (const, override));',
			'\tMOCK_METHOD(void, reset, (), (override));',
			'};',
		].join('\n'));
	});

	test('flatten (default) uses the flat name and fully-qualified base', () => {
		assert.strictEqual(stringifyMockClass(nestedClass), [
			'class app_Outer_Inner_Mock : public app::Outer::Inner {',
			'public:',
			'\tMOCK_METHOD(void, g, (), (override));',
			'};',
		].join('\n'));
	});

	test('flatten=false mirrors the namespace with a relative base', () => {
		assert.strictEqual(stringifyMockClass(nestedClass, false), [
			'namespace app {',
			'',
			'class Outer_Inner_Mock : public Outer::Inner {',
			'public:',
			'\tMOCK_METHOD(void, g, (), (override));',
			'};',
			'',
			'} // namespace app',
		].join('\n'));
	});

	test('flatten=false leaves a global-namespace class unwrapped', () => {
		assert.strictEqual(stringifyMockClass(globalClass, false), [
			'class Bare_Mock : public Bare {',
			'public:',
			'\tMOCK_METHOD(int, v, (), (override));',
			'};',
		].join('\n'));
	});

	test('stringifyMockClasses threads the flatten flag', () => {
		assert.ok(stringifyMockClasses([nestedClass], true).startsWith('class app_Outer_Inner_Mock'));
		assert.ok(stringifyMockClasses([nestedClass], false).startsWith('namespace app {'));
	});
});
