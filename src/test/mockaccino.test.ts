import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Regex-parser backend (concrete subclass of the abstract Mockaccino base).
// Requireable from compiled JS because its internal requires are extensionless.
const RegexMockaccino = require('../regex_mockaccino');

// Real template files shipped with the extension: out/test -> repo root.
const TEMPLATES = path.join(__dirname, '..', '..', 'templates');

// Minimal stand-ins for the vscode WorkspaceConfiguration and Uri objects the
// constructor expects: a `.get(key)` lookup plus a `.disableDoubleMocking` flag.
function makeConfig(overrides: any = {}) {
	const values: any = Object.assign({
		additionalPreprocessorDirectives: '',
		ignoredFunctionNames: '',
		copyright: 'Copyright (c) $YEAR Test.',
		treatLonelyPreprocIfAsActive: true,
		skipFunctionsWithImplicitReturnType: false,
		skipStaticFunctions: true,
		skipExternFunctions: true,
		outputPath: '',
	}, overrides);
	const cfg: any = { get: (k: string) => values[k] };
	cfg.disableDoubleMocking =
		overrides.disableDoubleMocking !== undefined ? overrides.disableDoubleMocking : true;
	return cfg;
}

function makeUri(fsPath: string, scheme: string = 'file') {
	return { fsPath, scheme };
}

suite('Mockaccino', () => {
	let originalLog: any;
	let originalWarn: any;
	let tmp: string;

	// The orchestrator is chatty; silence it so the test reporter stays readable.
	suiteSetup(() => {
		originalLog = console.log;
		originalWarn = console.warn;
		console.log = () => {};
		console.warn = () => {};
	});
	suiteTeardown(() => {
		console.log = originalLog;
		console.warn = originalWarn;
	});

	setup(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockaccino-'));
	});
	teardown(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	suite('name derivation', () => {
		test('derives names from the input file path', () => {
			const m = new RegexMockaccino(
				'int foo(void);', makeUri('/proj/widget.c'), makeConfig(), '1.0.0', '', TEMPLATES
			);
			assert.strictEqual(m.naming.name, 'widget');
			assert.strictEqual(m.naming.caps_name, 'WIDGET');
			assert.strictEqual(m.naming.header_name, 'widget.h');
			assert.strictEqual(m.naming.mock_name, 'Widget_Mock');
			assert.strictEqual(m.naming.mock_instance_name, 'widget_mock_');
			assert.strictEqual(m.naming.caps_mock_name, 'WIDGET_MOCK');
			assert.strictEqual(m.naming.caps_stub_name, 'WIDGET_STUB');
		});

		test('parses the function declarations out of the input body', () => {
			const m = new RegexMockaccino(
				'int foo(int a) {\n  return a;\n}\nvoid bar(void) {\n}\n',
				makeUri('/proj/widget.c'), makeConfig(), '1.0.0', '', TEMPLATES
			);
			assert.deepStrictEqual(m.c_functions_strings, ['int foo(int a);', 'void bar(void);']);
		});
	});

	suite('mock generation', () => {
		test('writes a header and source with MOCK_METHOD entries', () => {
			const content = 'int foo(int a) {\n  return a;\n}\nvoid bar(void) {\n}\n';
			const m = new RegexMockaccino(
				content, makeUri(path.join(tmp, 'foo.c')),
				makeConfig({ outputPath: tmp }), '1.2.3', '', TEMPLATES
			);
			const res = m.mock();
			assert.strictEqual(res.result, 0);
			assert.strictEqual(res.mock_count, 2);

			const header = fs.readFileSync(path.join(tmp, 'foo_mock.h'), 'utf8');
			assert.ok(header.includes('class Foo_Mock'), 'header declares the mock class');
			assert.ok(header.includes('MOCK_METHOD(int, foo, (int));'), 'header mocks foo');
			assert.ok(header.includes('MOCK_METHOD(void, bar, ());'), 'header mocks bar');

			const src = fs.readFileSync(path.join(tmp, 'foo_mock.cc'), 'utf8');
			assert.ok(src.includes('Foo_Mock::Foo_Mock()'), 'src defines the constructor');
			assert.ok(src.includes('foo_mock_->foo(a)'), 'src forwards the call to the mock instance');
		});

		test('honors mockHeaderExtension=hpp for the header file, guard, and .cc include', () => {
			const content = 'int foo(int a) {\n  return a;\n}\n';
			const m = new RegexMockaccino(
				content, makeUri(path.join(tmp, 'foo.c')),
				makeConfig({ outputPath: tmp, mockHeaderExtension: 'hpp' }), '1.2.3', '', TEMPLATES
			);
			assert.strictEqual(m.mock().result, 0);

			assert.ok(fs.existsSync(path.join(tmp, 'foo_mock.hpp')), 'writes a .hpp header');
			assert.ok(!fs.existsSync(path.join(tmp, 'foo_mock.h')), 'does not write a .h header');

			const header = fs.readFileSync(path.join(tmp, 'foo_mock.hpp'), 'utf8');
			assert.ok(header.includes('#ifndef FOO_MOCK_HPP'), 'include guard follows the extension');

			const src = fs.readFileSync(path.join(tmp, 'foo_mock.cc'), 'utf8');
			assert.ok(src.includes('#include "foo_mock.hpp"'), '.cc includes the .hpp header');
		});
	});

	suite('inline mock generation', () => {
		const IFACE = '#ifndef ISINK_H\n#define ISINK_H\nstruct ISink {\n  virtual void push(int) = 0;\n  virtual ~ISink() {}\n};\n#endif // ISINK_H\n';

		test('injects a guarded C++ mock class into the source content, before the guard', () => {
			const m = new RegexMockaccino(
				IFACE, makeUri(path.join(tmp, 'isink.hpp')), makeConfig(), '1.2.3', '', TEMPLATES
			);
			const res = m.mockInline(IFACE);
			assert.strictEqual(res.result, 0);
			assert.strictEqual(res.changed, true);
			assert.strictEqual(res.mock_count, 1);
			assert.ok(res.content.includes('class ISink_Mock'), 'injects the mock class');
			assert.ok(res.content.includes('#ifdef MOCKACCINO_INLINE_MOCKS'), 'guards with the test macro');
			assert.ok(res.content.includes('#include <gmock/gmock.h>'), 'pulls in gmock');
			assert.ok(res.content.indexOf('class ISink_Mock') < res.content.lastIndexOf('#endif'), 'stays inside the include guard');
			assert.ok(res.content.includes('struct ISink'), 'keeps the original interface');
		});

		test('uses a custom guard macro from config', () => {
			const m = new RegexMockaccino(
				IFACE, makeUri(path.join(tmp, 'isink.hpp')),
				makeConfig({ 'cpp.inlineMockGuardMacro': 'UNDER_TEST' }), '1.2.3', '', TEMPLATES
			);
			const res = m.mockInline(IFACE);
			assert.ok(res.content.includes('#ifdef UNDER_TEST'));
		});

		test('re-running regenerates in place rather than duplicating', () => {
			const m = new RegexMockaccino(
				IFACE, makeUri(path.join(tmp, 'isink.hpp')), makeConfig(), '1.2.3', '', TEMPLATES
			);
			const once = m.mockInline(IFACE).content;
			const m2 = new RegexMockaccino(
				once, makeUri(path.join(tmp, 'isink.hpp')), makeConfig(), '1.2.3', '', TEMPLATES
			);
			const twice = m2.mockInline(once);
			// Identical interface -> regeneration is idempotent (no duplication, no churn).
			assert.strictEqual(twice.content.split('class ISink_Mock').length - 1, 1, 'still a single mock class');
			assert.strictEqual(twice.content, once, 're-running an unchanged interface leaves the file as-is');
		});

		test('reports nothing to mock when the file has no C++ interfaces', () => {
			const content = 'int foo(int a);\n';
			const m = new RegexMockaccino(
				content, makeUri(path.join(tmp, 'plain.h')), makeConfig(), '1.2.3', '', TEMPLATES
			);
			const res = m.mockInline(content);
			assert.strictEqual(res.result, 2);
			assert.strictEqual(res.changed, false);
		});
	});

	suite('stub generation', () => {
		test('writes a stub source that prints info and returns zero values', () => {
			const content = 'int foo(int a) {\n  return a;\n}\nvoid bar(void) {\n}\n';
			const m = new RegexMockaccino(
				content, makeUri(path.join(tmp, 'foo.c')),
				makeConfig({ outputPath: tmp }), '1.2.3', '', TEMPLATES
			);
			const res = m.stub();
			assert.strictEqual(res.result, 0);
			assert.strictEqual(res.mock_count, 2);

			const src = fs.readFileSync(path.join(tmp, 'foo_stub.cc'), 'utf8');
			assert.ok(src.includes('FOO_STUB_PRINT_INFO();'), 'stub prints info');
			assert.ok(src.includes('return static_cast<int>(0);'), 'non-void stub returns a zero cast');
			assert.ok(src.includes('int foo(int)'), 'stub keeps the foo signature');
		});
	});

	suite('guards', () => {
		test('skips double mocking when the file name already ends with _mock', () => {
			const m = new RegexMockaccino(
				'int foo(void);', makeUri(path.join(tmp, 'foo_mock.c')),
				makeConfig({ outputPath: tmp, disableDoubleMocking: true }), '1', '', TEMPLATES
			);
			assert.strictEqual(m.mock().result, 1);
		});

		test('returns an error for a non-file uri scheme', () => {
			const m = new RegexMockaccino(
				'int foo(void);', makeUri(path.join(tmp, 'foo.c'), 'untitled'),
				makeConfig({ outputPath: tmp }), '1', '', TEMPLATES
			);
			assert.strictEqual(m.mock().result, 3);
		});
	});
});
