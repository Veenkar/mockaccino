import * as assert from 'assert';

// Pure module, no vscode dependency. Required from compiled JS output.
const Interpolator = require('../interpolator');

suite('Interpolator', () => {
	test('substitutes named placeholders', () => {
		const interp = new Interpolator({ greeting: 'Hello', name: 'World' });
		assert.strictEqual(interp.interpolate('${greeting} ${name}!'), 'Hello World!');
	});

	test('supports nested property access', () => {
		const interp = new Interpolator({ instance: { name: 'foo', caps_name: 'FOO' } });
		assert.strictEqual(
			interp.interpolate('${instance.name} / ${instance.caps_name}'),
			'foo / FOO'
		);
	});

	test('preserves single backslashes from the template', () => {
		const interp = new Interpolator({ x: 'v' });
		// A literal backslash in the template must survive interpolation.
		assert.strictEqual(interp.interpolate('a\\b ${x}'), 'a\\b v');
	});

	test('leaves text without placeholders untouched', () => {
		const interp = new Interpolator({});
		assert.strictEqual(interp.interpolate('plain text'), 'plain text');
	});

	test('evaluates expressions inside placeholders', () => {
		const interp = new Interpolator({ n: 3 });
		assert.strictEqual(interp.interpolate('${n + 1}'), '4');
	});
});
