import * as assert from 'assert';

const StructuredHelpers = require('../structured_helpers');

suite('structured_helpers.projectArgs', () => {
	test('projects types / signature / names from structured params', () => {
		const fn = { params: [{ type: 'int', name: 'a' }, { type: 'const char *', name: 'b' }] };
		assert.deepStrictEqual(StructuredHelpers.projectArgs(fn), {
			types: 'int, const char *',
			signature: 'int a, const char * b',
			names: 'a, b',
		});
	});

	test('synthesises names for unnamed params', () => {
		const fn = { params: [{ type: 'int', name: '' }, { type: 'char *', name: '' }] };
		assert.deepStrictEqual(StructuredHelpers.projectArgs(fn), {
			types: 'int, char *',
			signature: 'int arg1, char * arg2',
			names: 'arg1, arg2',
		});
	});

	test('no params renders empty projections', () => {
		assert.deepStrictEqual(StructuredHelpers.projectArgs({ params: [] }), { types: '', signature: '', names: '' });
	});

	test('variadic adds ... to types/signature but not names', () => {
		const fn = { params: [{ type: 'const char *', name: 'fmt' }], is_variadic: true };
		const p = StructuredHelpers.projectArgs(fn);
		assert.strictEqual(p.types, 'const char *, ...');
		assert.strictEqual(p.signature, 'const char * fmt, ...');
		assert.strictEqual(p.names, 'fmt');
	});
});

suite('structured_helpers.filterFunctions', () => {
	const fns = [
		{ name: 'keep', is_static: false, is_extern: false },
		{ name: 'stat', is_static: true, is_extern: false },
		{ name: 'ext', is_static: false, is_extern: true },
		{ name: 'main', is_static: false, is_extern: false },
		{ name: 'keep', is_static: false, is_extern: false }, // duplicate
	];

	test('skips static and extern, drops ignored names, dedupes', () => {
		const out = StructuredHelpers.filterFunctions(fns, {
			skipStatic: true,
			skipExtern: true,
			ignored: ['main'],
		});
		assert.deepStrictEqual(out.map((f: any) => f.name), ['keep']);
	});

	test('keeps everything (deduped) when no filters set', () => {
		const out = StructuredHelpers.filterFunctions(fns, {});
		assert.deepStrictEqual(out.map((f: any) => f.name), ['keep', 'stat', 'ext', 'main']);
	});

	test('ignored list of [] is a no-op', () => {
		const out = StructuredHelpers.filterFunctions(fns, { ignored: [] });
		assert.deepStrictEqual(out.map((f: any) => f.name), ['keep', 'stat', 'ext', 'main']);
	});
});
