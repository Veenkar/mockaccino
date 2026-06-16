import * as assert from 'assert';

const Naming = require('../naming');

suite('Naming source extension and C++ mock path', () => {
	test('defaults the C-wrapper source extension to .cc', () => {
		const n = new Naming('/proj/foo.h');
		assert.ok(n.defaultMockSrcPath.endsWith('foo_mock.cc'));
		assert.ok(n.defaultStubSrcPath.endsWith('foo_stub.cc'));
		assert.strictEqual(n.sourceExt, 'cc');
	});

	test('honors the cpp source extension', () => {
		const n = new Naming('/proj/foo.h', 'cpp');
		assert.ok(n.defaultMockSrcPath.endsWith('foo_mock.cpp'));
		assert.ok(n.defaultStubSrcPath.endsWith('foo_stub.cpp'));
		assert.strictEqual(n.sourceExt, 'cpp');
	});

	test('an unknown extension value falls back to cc', () => {
		const n = new Naming('/proj/foo.h', 'cxx');
		assert.strictEqual(n.sourceExt, 'cc');
	});

	test('the single mock header stays .h regardless of input extension', () => {
		const n = new Naming('/proj/foo.hpp', 'cpp');
		assert.ok(n.defaultMockHeaderPath.endsWith('foo_mock.h'));
	});
});
