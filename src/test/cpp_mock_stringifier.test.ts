import * as assert from 'assert';

const { stringifyMockClass, stringifyMockMethod, methodSpecs } = require('../cpp_mock_stringifier');

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
});
