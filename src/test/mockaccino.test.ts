import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Orchestrator module. Now requireable from compiled JS because its internal
// requires were changed from "./preprocessor.ts" to "./preprocessor" (etc).
const Mockaccino = require('../mockaccino');

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
			const m = new Mockaccino(
				'int foo(void);', makeUri('/proj/widget.c'), makeConfig(), '1.0.0', '', TEMPLATES
			);
			assert.strictEqual(m.name, 'widget');
			assert.strictEqual(m.caps_name, 'WIDGET');
			assert.strictEqual(m.header_name, 'widget.h');
			assert.strictEqual(m.mock_name, 'Widget_Mock');
			assert.strictEqual(m.mock_instance_name, 'widget_mock_');
			assert.strictEqual(m.caps_mock_name, 'WIDGET_MOCK');
			assert.strictEqual(m.caps_stub_name, 'WIDGET_STUB');
		});

		test('parses the function declarations out of the input body', () => {
			const m = new Mockaccino(
				'int foo(int a) {\n  return a;\n}\nvoid bar(void) {\n}\n',
				makeUri('/proj/widget.c'), makeConfig(), '1.0.0', '', TEMPLATES
			);
			assert.deepStrictEqual(m.c_functions_strings, ['int foo(int a);', 'void bar(void);']);
		});
	});

	suite('mock generation', () => {
		test('writes a header and source with MOCK_METHOD entries', () => {
			const content = 'int foo(int a) {\n  return a;\n}\nvoid bar(void) {\n}\n';
			const m = new Mockaccino(
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
	});

	suite('stub generation', () => {
		test('writes a stub source that prints info and returns zero values', () => {
			const content = 'int foo(int a) {\n  return a;\n}\nvoid bar(void) {\n}\n';
			const m = new Mockaccino(
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
			const m = new Mockaccino(
				'int foo(void);', makeUri(path.join(tmp, 'foo_mock.c')),
				makeConfig({ outputPath: tmp, disableDoubleMocking: true }), '1', '', TEMPLATES
			);
			assert.strictEqual(m.mock().result, 1);
		});

		test('returns an error for a non-file uri scheme', () => {
			const m = new Mockaccino(
				'int foo(void);', makeUri(path.join(tmp, 'foo.c'), 'untitled'),
				makeConfig({ outputPath: tmp }), '1', '', TEMPLATES
			);
			assert.strictEqual(m.mock().result, 3);
		});
	});
});
