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

	test('defaults the mock header extension to .h', () => {
		const n = new Naming('/proj/foo.hpp', 'cpp');
		assert.strictEqual(n.headerExt, 'h');
		assert.ok(n.defaultMockHeaderPath.endsWith('foo_mock.h'));
		assert.strictEqual(n.mock_header_name, 'foo_mock.h');
		assert.strictEqual(n.mock_header_guard, 'FOO_MOCK_H');
	});

	test('honors the hpp header extension (path, filename, include guard)', () => {
		const n = new Naming('/proj/foo.c', 'cc', 'hpp');
		assert.strictEqual(n.headerExt, 'hpp');
		assert.ok(n.defaultMockHeaderPath.endsWith('foo_mock.hpp'));
		assert.strictEqual(n.mock_header_name, 'foo_mock.hpp');
		assert.strictEqual(n.mock_header_guard, 'FOO_MOCK_HPP');
	});

	test('an unknown header extension value falls back to h', () => {
		const n = new Naming('/proj/foo.c', 'cc', 'hxx');
		assert.strictEqual(n.headerExt, 'h');
		assert.strictEqual(n.mock_header_name, 'foo_mock.h');
	});
});
