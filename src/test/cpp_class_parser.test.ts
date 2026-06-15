import * as assert from 'assert';

const { extractCppClasses, mockClassNameFor } = require('../cpp_class_parser');

function byName(classes: any[], name: string): any {
	return classes.find((c) => c.name === name);
}

suite('cpp_class_parser.extractCppClasses', () => {
	test('extracts an interface with qualified name and pure-virtual methods', () => {
		const src = `
			namespace app {
			  class IFoo {
			  public:
			    virtual int f(int x) const = 0;
			    virtual void reset() = 0;
			  };
			}`;
		const classes = extractCppClasses(src);
		assert.strictEqual(classes.length, 1);
		const c = classes[0];
		assert.strictEqual(c.qualifiedName, 'app::IFoo');
		assert.strictEqual(c.mockClassName, 'app_IFoo_Mock');
		assert.strictEqual(c.isAbstract, true);
		assert.deepStrictEqual(c.methods.map((m: any) => m.name), ['f', 'reset']);
		assert.strictEqual(c.methods[0].isConst, true);
		assert.strictEqual(c.methods[0].isPure, true);
		assert.strictEqual(c.methods[0].paramTypes, 'int');
	});

	test('handles nested namespaces and nested classes with full qualification', () => {
		const src = `
			namespace a { namespace b {
			  struct Outer {
			    class Inner { virtual void g(const char* s) = 0; };
			  };
			} }`;
		const classes = extractCppClasses(src);
		const inner = byName(classes, 'Inner');
		assert.ok(inner, 'innermost class extracted');
		assert.strictEqual(inner.qualifiedName, 'a::b::Outer::Inner');
		assert.strictEqual(inner.mockClassName, 'a_b_Outer_Inner_Mock');
		assert.deepStrictEqual(inner.namespaces, ['a', 'b']);
		assert.deepStrictEqual(inner.classPath, ['Outer', 'Inner']);
		assert.strictEqual(inner.methods[0].paramTypes, 'const char*');
	});

	test('drops classes with no mockable methods (Outer that only nests Inner)', () => {
		const src = `
			struct Outer {
			  class Inner { virtual void g() = 0; };
			  int plain() { return 0; }
			};`;
		const classes = extractCppClasses(src);
		assert.deepStrictEqual(classes.map((c: any) => c.name), ['Inner']);
	});

	test('treats override-without-virtual as virtual, and skips non-virtual', () => {
		const src = `
			class C {
			  virtual bool ok() override;
			  int helper() { return 1; }
			  void no();
			};`;
		const c = extractCppClasses(src)[0];
		assert.deepStrictEqual(c.methods.map((m: any) => m.name), ['ok']);
		assert.strictEqual(c.isAbstract, false);
	});

	test('skips final, destructors, constructors, operators and templated/static methods', () => {
		const src = `
			class C {
			public:
			  C();
			  virtual ~C();
			  virtual int sealed() final;
			  virtual bool operator==(const C& o) const = 0;
			  static virtual void s();
			  template<class T> virtual void t();
			  virtual int keep() = 0;
			};`;
		const c = extractCppClasses(src)[0];
		assert.deepStrictEqual(c.methods.map((m: any) => m.name), ['keep']);
	});

	test('records const and noexcept method qualifiers', () => {
		const src = `
			class C {
			  virtual int a() const = 0;
			  virtual void b() noexcept = 0;
			};`;
		const c = extractCppClasses(src)[0];
		assert.strictEqual(c.methods[0].isConst, true);
		assert.strictEqual(c.methods[1].isNoexcept, true);
	});

	test('comments and preprocessor lines do not break the scope walker', () => {
		const src = `
			#include "iface.h"
			// a leading comment
			namespace n {
			  /* block */ class I { public: virtual int f() = 0; }; // trailing
			}`;
		const c = extractCppClasses(src)[0];
		assert.strictEqual(c.qualifiedName, 'n::I');
		assert.deepStrictEqual(c.methods.map((m: any) => m.name), ['f']);
	});

	test('mockClassNameFor flattens the scope path', () => {
		assert.strictEqual(mockClassNameFor('app::Outer::Inner'), 'app_Outer_Inner_Mock');
		assert.strictEqual(mockClassNameFor('IFoo'), 'IFoo_Mock');
	});
});
