import * as assert from 'assert';

const AiParser = require('../ai_parser');

suite('AiParser.extractJsonArray', () => {
	test('returns a bare array unchanged', () => {
		assert.strictEqual(AiParser.extractJsonArray('[{"name":"f"}]'), '[{"name":"f"}]');
	});

	test('strips ```json fences', () => {
		const raw = 'Here you go:\n```json\n[{"name":"f"}]\n```\nThanks!';
		assert.strictEqual(AiParser.extractJsonArray(raw), '[{"name":"f"}]');
	});

	test('pulls the array out of surrounding prose', () => {
		assert.strictEqual(AiParser.extractJsonArray('The functions are [1, 2] in total.'), '[1, 2]');
	});

	test('returns [] when there is no array', () => {
		assert.strictEqual(AiParser.extractJsonArray('no json here'), '[]');
	});
});

suite('AiParser.extractFunctions', () => {
	test('maps a well-formed response to structured functions', () => {
		const raw = JSON.stringify([
			{ returnType: 'const char *', name: 'name_of', params: [{ type: 'int', name: 'id' }], is_static: false, is_extern: false, is_variadic: false },
		]);
		assert.deepStrictEqual(AiParser.extractFunctions(raw), [
			{ returnType: 'const char *', name: 'name_of', params: [{ type: 'int', name: 'id' }], is_static: false, is_extern: false, is_variadic: false },
		]);
	});

	test('defaults missing fields (returnType -> int, flags -> false, params -> [])', () => {
		const out = AiParser.extractFunctions('[{"name":"f"}]');
		assert.deepStrictEqual(out, [
			{ returnType: 'int', name: 'f', params: [], is_static: false, is_extern: false, is_variadic: false },
		]);
	});

	test('keeps unnamed params and coerces param fields', () => {
		const out = AiParser.extractFunctions('[{"name":"g","params":[{"type":"int"},{"name":"x"}]}]');
		assert.deepStrictEqual(out[0].params, [{ type: 'int', name: '' }, { type: '', name: 'x' }]);
	});

	test('skips entries with no name, and ignores non-objects', () => {
		const out = AiParser.extractFunctions('[{"name":""}, 5, null, {"name":"ok"}]');
		assert.deepStrictEqual(out.map((f: any) => f.name), ['ok']);
	});

	test('returns [] for unparseable / non-array output', () => {
		assert.deepStrictEqual(AiParser.extractFunctions('garbage'), []);
		assert.deepStrictEqual(AiParser.extractFunctions('{"name":"f"}'), []);
	});
});

suite('AiParser.buildPrompt', () => {
	test('mentions the filename and the JSON schema fields', () => {
		const prompt = AiParser.buildPrompt('int foo(void);', 'foo.h');
		assert.ok(prompt.includes('foo.h'));
		assert.ok(prompt.includes('"is_variadic"'));
		assert.ok(prompt.includes('int foo(void);'));
	});
});

suite('AiParser.parse (with a fake completion)', () => {
	test('feeds the prompt to complete() and returns the parsed functions', async () => {
		let seenPrompt = '';
		const fakeComplete = async (prompt: string) => {
			seenPrompt = prompt;
			return '```json\n[{"returnType":"void","name":"foo","params":[]}]\n```';
		};
		const parser = new AiParser(fakeComplete);
		const fns = await parser.parse('void foo(void);', 'foo.h');
		assert.ok(seenPrompt.includes('void foo(void);'), 'the source was put in the prompt');
		assert.deepStrictEqual(fns.map((f: any) => f.name), ['foo']);
	});
});
