import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const AiMockaccino = require('../ai_mockaccino');

const TEMPLATES = path.join(__dirname, '..', '..', 'templates');

function makeConfig(overrides: any = {}) {
	const values: any = Object.assign({
		additionalPreprocessorDirectives: '',
		ignoredFunctionNames: 'main',
		copyright: 'Copyright (c) $YEAR Test.',
		treatLonelyPreprocIfAsActive: true,
		skipFunctionsWithImplicitReturnType: false,
		skipStaticFunctions: true,
		skipExternFunctions: true,
		outputPath: '',
		'ai.inputMode': 'fullFile',
	}, overrides);
	const cfg: any = { get: (k: string) => values[k] };
	cfg.disableDoubleMocking = overrides.disableDoubleMocking !== undefined ? overrides.disableDoubleMocking : true;
	return cfg;
}

const makeUri = (fsPath: string, scheme = 'file') => ({ fsPath, scheme });

// A fake model: returns a fixed structured function list regardless of prompt, and
// records the prompt it was given so tests can assert what the model was shown.
function fakeModel(functions: any[]) {
	const calls: string[] = [];
	const complete = async (prompt: string) => {
		calls.push(prompt);
		return JSON.stringify(functions);
	};
	return { complete, calls };
}

suite('AiMockaccino', () => {
	let log: any, warn: any, tmp: string;
	suiteSetup(() => { log = console.log; warn = console.warn; console.log = () => {}; console.warn = () => {}; });
	suiteTeardown(() => { console.log = log; console.warn = warn; });
	setup(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aimock-')); });
	teardown(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

	test('generates a mock from the AI-parsed function list', async () => {
		const model = fakeModel([
			{ returnType: 'int', name: 'foo', params: [{ type: 'int', name: 'a' }] },
			{ returnType: 'void', name: 'bar', params: [] },
		]);
		const m = new AiMockaccino(
			'int foo(int a);\nvoid bar(void);\n', makeUri(path.join(tmp, 'foo.c')),
			makeConfig({ outputPath: tmp }), '1.2.3', '', TEMPLATES, model.complete,
		);
		await m.prepare();
		const res = m.mock();
		assert.strictEqual(res.result, 0);
		assert.strictEqual(res.mock_count, 2);

		const header = fs.readFileSync(path.join(tmp, 'foo_mock.h'), 'utf8');
		assert.ok(header.includes('MOCK_METHOD(int, foo, (int));'));
		assert.ok(header.includes('MOCK_METHOD(void, bar, ());'));
		const src = fs.readFileSync(path.join(tmp, 'foo_mock.cc'), 'utf8');
		assert.ok(src.includes('foo_mock_->foo(a)'), 'forwards the call with the param name');
	});

	test('generates a stub with safe defaults', async () => {
		const model = fakeModel([
			{ returnType: 'const char *', name: 'name_of', params: [] },
			{ returnType: 'int', name: 'count', params: [] },
		]);
		const m = new AiMockaccino(
			'x', makeUri(path.join(tmp, 'thing.c')), makeConfig({ outputPath: tmp }), '1', '', TEMPLATES, model.complete,
		);
		await m.prepare();
		assert.strictEqual(m.stub().result, 0);
		const src = fs.readFileSync(path.join(tmp, 'thing_stub.cc'), 'utf8');
		assert.ok(src.includes('return nullptr;'), 'pointer return -> nullptr');
		assert.ok(src.includes('return static_cast<int>(0);'), 'scalar return -> zero cast');
	});

	test('applies the shared filters (ignored names, static)', async () => {
		const model = fakeModel([
			{ returnType: 'int', name: 'main', params: [] },              // ignored
			{ returnType: 'int', name: 'hidden', params: [], is_static: true }, // static
			{ returnType: 'int', name: 'keep', params: [] },
		]);
		const m = new AiMockaccino('x', makeUri(path.join(tmp, 'f.c')), makeConfig({ outputPath: tmp }), '1', '', TEMPLATES, model.complete);
		await m.prepare();
		const res = m.mock();
		assert.strictEqual(res.mock_count, 1);
		assert.ok(fs.readFileSync(path.join(tmp, 'f_mock.h'), 'utf8').includes('MOCK_METHOD(int, keep, ());'));
	});

	test('inputMode "fullFile" sends the whole source to the model', async () => {
		const model = fakeModel([{ returnType: 'int', name: 'foo', params: [] }]);
		const content = 'int foo(void) {\n  return 42;\n}\n';
		const m = new AiMockaccino(content, makeUri(path.join(tmp, 'foo.c')), makeConfig({ outputPath: tmp, 'ai.inputMode': 'fullFile' }), '1', '', TEMPLATES, model.complete);
		await m.prepare();
		assert.ok(model.calls[0].includes('return 42;'), 'full-file mode includes the function body');
	});

	test('inputMode "declarations" sends only the preprocessed declarations', async () => {
		const model = fakeModel([{ returnType: 'int', name: 'foo', params: [] }]);
		const content = 'int foo(int a) {\n  return 42;\n}\n';
		const m = new AiMockaccino(content, makeUri(path.join(tmp, 'foo.c')), makeConfig({ outputPath: tmp, 'ai.inputMode': 'declarations' }), '1', '', TEMPLATES, model.complete);
		await m.prepare();
		assert.ok(model.calls[0].includes('int foo(int a);'), 'declaration is present');
		assert.ok(!model.calls[0].includes('return 42;'), 'function body is stripped');
	});

	test('mock()/stub() before prepare() throws a clear error', () => {
		const model = fakeModel([]);
		const m = new AiMockaccino('x', makeUri(path.join(tmp, 'f.c')), makeConfig({ outputPath: tmp }), '1', '', TEMPLATES, model.complete);
		assert.throws(() => m.mock(), /call await prepare\(\)/);
	});
});
