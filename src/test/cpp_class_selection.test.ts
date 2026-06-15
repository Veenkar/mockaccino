import * as assert from 'assert';

const { selectMockClasses, nameMatchesInterface } = require('../cpp_class_selection');

const abstractClass = { name: 'Service', isAbstract: true };
const concreteVirtual = { name: 'Widget', isAbstract: false };
const namedInterface = { name: 'IThingInterface', isAbstract: false };

suite('cpp_class_selection.selectMockClasses', () => {
	const patterns = ['interface'];

	test('onlyVirtualOrInterface keeps abstract classes and interface-named ones', () => {
		const kept = selectMockClasses([abstractClass, concreteVirtual, namedInterface], {
			onlyVirtualOrInterface: true,
			interfaceNamePatterns: patterns,
		});
		assert.deepStrictEqual(kept.map((c: any) => c.name), ['Service', 'IThingInterface']);
	});

	test('onlyVirtualOrInterface = false keeps every (already-mockable) class', () => {
		const kept = selectMockClasses([abstractClass, concreteVirtual, namedInterface], {
			onlyVirtualOrInterface: false,
			interfaceNamePatterns: patterns,
		});
		assert.strictEqual(kept.length, 3);
	});

	test('name matching is case-insensitive and substring-based', () => {
		assert.ok(nameMatchesInterface('MyINTERFACEImpl', ['interface']));
		assert.ok(nameMatchesInterface('Abstract', ['abstract', 'iface']));
		assert.ok(!nameMatchesInterface('Widget', ['interface']));
		assert.ok(!nameMatchesInterface('Widget', []));
	});
});
