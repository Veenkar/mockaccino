import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const IncludePaths = require('../include_paths');

suite('IncludePaths.normalize', () => {
	test('expands ${workspaceFolder}', () => {
		assert.deepStrictEqual(
			IncludePaths.normalize(['${workspaceFolder}/include'], '/proj'),
			['/proj/include'],
		);
	});

	test('strips trailing recursive globs down to the base dir', () => {
		assert.deepStrictEqual(
			IncludePaths.normalize(['/proj/**', '/proj/src/*'], ''),
			['/proj', '/proj/src'],
		);
	});

	test('drops ${default} and entries with unresolved variables', () => {
		assert.deepStrictEqual(
			IncludePaths.normalize(['${default}', '${env:FOO}/x', '/real'], ''),
			['/real'],
		);
	});

	test('dedupes, keeping first occurrence (priority order)', () => {
		assert.deepStrictEqual(
			IncludePaths.normalize(['/a', '/b', '/a', '  /b  '], ''),
			['/a', '/b'],
		);
	});

	test('ignores empties and non-strings', () => {
		assert.deepStrictEqual(
			IncludePaths.normalize(['', '   ', null as any, '/a'], ''),
			['/a'],
		);
	});
});

suite('IncludePaths.fromCCppPropertiesFile', () => {
	let tmp: string;
	setup(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccpp-')); });
	teardown(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

	test('unions includePath across all configurations', () => {
		const file = path.join(tmp, 'c_cpp_properties.json');
		fs.writeFileSync(file, JSON.stringify({
			version: 4,
			configurations: [
				{ name: 'Win32', includePath: ['${workspaceFolder}/**', 'C:/sdk/include'] },
				{ name: 'Linux', includePath: ['/usr/local/include'] },
			],
		}));
		assert.deepStrictEqual(
			IncludePaths.fromCCppPropertiesFile(file),
			['${workspaceFolder}/**', 'C:/sdk/include', '/usr/local/include'],
		);
	});

	test('returns [] for a missing file', () => {
		assert.deepStrictEqual(IncludePaths.fromCCppPropertiesFile(path.join(tmp, 'nope.json')), []);
	});

	test('returns [] for invalid JSON rather than throwing', () => {
		const file = path.join(tmp, 'bad.json');
		fs.writeFileSync(file, '{ this is not json }');
		assert.deepStrictEqual(IncludePaths.fromCCppPropertiesFile(file), []);
	});
});
