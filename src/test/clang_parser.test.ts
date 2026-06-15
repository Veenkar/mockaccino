import * as assert from 'assert';

// Compiled sibling module (no clang needed for the pure AST-mapping logic).
const ClangParser = require('../clang_parser');

suite('ClangParser.returnTypeOf', () => {
	test('strips the top-level parameter list', () => {
		assert.strictEqual(ClangParser.returnTypeOf('void (int, int)'), 'void');
		assert.strictEqual(ClangParser.returnTypeOf('int (void)'), 'int');
		assert.strictEqual(ClangParser.returnTypeOf('const char *(void)'), 'const char *');
	});

	test('keeps parens that belong to the return type, not the param list', () => {
		// pointer-to-function return: the first top-level paren is the param list
		assert.strictEqual(ClangParser.returnTypeOf('struct S (int)'), 'struct S');
	});
});

suite('ClangParser.isMainFile', () => {
	test('only the stdin translation unit is the target', () => {
		assert.strictEqual(ClangParser.isMainFile('<stdin>'), true);
		assert.strictEqual(ClangParser.isMainFile('/usr/include/stdio.h'), false);
		assert.strictEqual(ClangParser.isMainFile('.\\display.h'), false);
	});
});

suite('ClangParser.extractTargetFunctions', () => {
	// Minimal stand-in for clang's JSON AST. clang only emits loc.file when it
	// changes between siblings, so nodes before the first loc.file are <stdin>.
	const ast = {
		kind: 'TranslationUnitDecl',
		inner: [
			{ kind: 'TypedefDecl', isImplicit: true },                 // not a function
			{ kind: 'FunctionDecl', isImplicit: true, name: '__builtin' }, // implicit -> skip
			{
				kind: 'FunctionDecl', name: 'foo', type: { qualType: 'int (int, const char *)' },
				inner: [
					{ kind: 'ParmVarDecl', name: 'a', type: { qualType: 'int' } },
					{ kind: 'ParmVarDecl', name: 'b', type: { qualType: 'const char *' } },
				],
			},
			{ kind: 'FunctionDecl', name: 'hidden', storageClass: 'static', type: { qualType: 'void (void)' }, inner: [] },
			{
				kind: 'FunctionDecl', name: 'logf', type: { qualType: 'int (const char *, ...)' },
				inner: [{ kind: 'ParmVarDecl', name: 'fmt', type: { qualType: 'const char *' } }],
			},
			{ kind: 'FunctionDecl', name: '', type: { qualType: 'void (void)' }, inner: [] }, // anonymous -> skip
			// switch into an included header: everything here must be filtered out
			{ loc: { file: '/usr/include/stdio.h' }, kind: 'FunctionDecl', name: 'printf', type: { qualType: 'int (const char *, ...)' }, inner: [] },
			// switch back to the main file
			{ loc: { file: '<stdin>' }, kind: 'FunctionDecl', name: 'after', type: { qualType: 'void (void)' }, inner: [] },
		],
	};

	const fns = ClangParser.extractTargetFunctions(ast);

	test('keeps only named, explicit functions from the main file', () => {
		assert.deepStrictEqual(fns.map((f: any) => f.name), ['foo', 'hidden', 'logf', 'after']);
	});

	test('extracts return type and structured params', () => {
		const foo = fns.find((f: any) => f.name === 'foo');
		assert.strictEqual(foo.returnType, 'int');
		assert.deepStrictEqual(foo.params, [
			{ type: 'int', name: 'a' },
			{ type: 'const char *', name: 'b' },
		]);
	});

	test('detects the static storage class', () => {
		assert.strictEqual(fns.find((f: any) => f.name === 'hidden').is_static, true);
		assert.strictEqual(fns.find((f: any) => f.name === 'foo').is_static, false);
	});

	test('detects variadic functions', () => {
		assert.strictEqual(fns.find((f: any) => f.name === 'logf').is_variadic, true);
		assert.strictEqual(fns.find((f: any) => f.name === 'foo').is_variadic, false);
	});

	test('excludes declarations from included headers', () => {
		assert.ok(!fns.some((f: any) => f.name === 'printf'), 'printf is from stdio.h and must be excluded');
	});
});

suite('ClangParser.extractTargetFunctions (signature shapes)', () => {
	function one(node: any) {
		return ClangParser.extractTargetFunctions({ inner: [node] })[0];
	}

	test('extern storage class is detected', () => {
		const fn = one({ kind: 'FunctionDecl', name: 'e', storageClass: 'extern', type: { qualType: 'void (void)' }, inner: [] });
		assert.strictEqual(fn.is_extern, true);
		assert.strictEqual(fn.is_static, false);
	});

	test('unnamed parameters keep an empty name (caller synthesises one)', () => {
		const fn = one({
			kind: 'FunctionDecl', name: 'f', type: { qualType: 'void (int, char *)' },
			inner: [
				{ kind: 'ParmVarDecl', type: { qualType: 'int' } },
				{ kind: 'ParmVarDecl', type: { qualType: 'char *' } },
			],
		});
		assert.deepStrictEqual(fn.params, [
			{ type: 'int', name: '' },
			{ type: 'char *', name: '' },
		]);
	});

	test('struct-by-value parameter keeps its type spelling', () => {
		const fn = one({
			kind: 'FunctionDecl', name: 'g', type: { qualType: 'void (Viewport)' },
			inner: [{ kind: 'ParmVarDecl', name: 'vp', type: { qualType: 'Viewport' } }],
		});
		assert.deepStrictEqual(fn.params, [{ type: 'Viewport', name: 'vp' }]);
	});

	test('const-pointer return type is preserved', () => {
		const fn = one({ kind: 'FunctionDecl', name: 'name', type: { qualType: 'const char *(void)' }, inner: [] });
		assert.strictEqual(fn.returnType, 'const char *');
		assert.deepStrictEqual(fn.params, []);
	});

	test('a definition (body present) is parsed, ignoring non-param inner nodes', () => {
		// A FunctionDecl with a body has a CompoundStmt sibling to the ParmVarDecls.
		const fn = one({
			kind: 'FunctionDecl', name: 'def', type: { qualType: 'int (int)' },
			inner: [
				{ kind: 'ParmVarDecl', name: 'x', type: { qualType: 'int' } },
				{ kind: 'CompoundStmt', inner: [] },
			],
		});
		assert.strictEqual(fn.name, 'def');
		assert.deepStrictEqual(fn.params, [{ type: 'int', name: 'x' }]);
	});

	test('a function with no prototype has no params', () => {
		const fn = one({ kind: 'FunctionDecl', name: 'noproto', type: { qualType: 'int ()' }, inner: [] });
		assert.strictEqual(fn.returnType, 'int');
		assert.deepStrictEqual(fn.params, []);
	});
});

suite('ClangParser.extractCppClasses', () => {
	// A C++ AST: namespace app holds an interface IFoo and a nested Outer::Inner.
	const ast = {
		kind: 'TranslationUnitDecl',
		inner: [
			{
				kind: 'NamespaceDecl', name: 'app',
				inner: [
					{
						kind: 'CXXRecordDecl', name: 'IFoo', tagUsed: 'class',
						inner: [
							{ kind: 'CXXConstructorDecl', name: 'IFoo' },
							{ kind: 'CXXDestructorDecl', name: '~IFoo', virtual: true },
							{
								kind: 'CXXMethodDecl', name: 'f', virtual: true, pure: true,
								type: { qualType: 'int (int) const' },
								inner: [{ kind: 'ParmVarDecl', name: 'x', type: { qualType: 'int' } }],
							},
							{ kind: 'CXXMethodDecl', name: 'plain', type: { qualType: 'void (void)' }, inner: [] }, // non-virtual
							{ kind: 'CXXMethodDecl', name: 'sealed', virtual: true, type: { qualType: 'void (void)' }, inner: [{ kind: 'FinalAttr' }] },
						],
					},
					{
						kind: 'CXXRecordDecl', name: 'Outer', tagUsed: 'struct',
						inner: [
							{
								kind: 'CXXRecordDecl', name: 'Inner', tagUsed: 'class',
								inner: [
									{ kind: 'CXXMethodDecl', name: 'g', virtual: true, pure: true, type: { qualType: 'void (const char *) noexcept' }, inner: [{ kind: 'ParmVarDecl', type: { qualType: 'const char *' } }] },
								],
							},
						],
					},
				],
			},
			// A class from an included header must be filtered out.
			{ loc: { file: '/usr/include/thing.hpp' }, kind: 'CXXRecordDecl', name: 'Hidden', inner: [{ kind: 'CXXMethodDecl', name: 'z', virtual: true, pure: true, type: { qualType: 'void (void)' }, inner: [] }] },
		],
	};

	const classes = ClangParser.extractCppClasses(ast);

	test('keeps main-file classes with mockable methods, fully qualified', () => {
		assert.deepStrictEqual(
			classes.map((c: any) => c.qualifiedName).sort(),
			['app::IFoo', 'app::Outer::Inner'],
		);
	});

	test('drops constructors/destructors/non-virtual/final, keeps virtuals', () => {
		const ifoo = classes.find((c: any) => c.name === 'IFoo');
		assert.deepStrictEqual(ifoo.methods.map((m: any) => m.name), ['f']);
		assert.strictEqual(ifoo.methods[0].isConst, true);
		assert.strictEqual(ifoo.methods[0].isPure, true);
		assert.strictEqual(ifoo.methods[0].paramTypes, 'int');
		assert.strictEqual(ifoo.isAbstract, true);
	});

	test('nested class qualifies through namespace + outer, and detects noexcept', () => {
		const inner = classes.find((c: any) => c.name === 'Inner');
		assert.strictEqual(inner.mockClassName, 'app_Outer_Inner_Mock');
		assert.strictEqual(inner.methods[0].isNoexcept, true);
		assert.strictEqual(inner.methods[0].paramTypes, 'const char *');
	});

	test('excludes classes declared in included headers', () => {
		assert.ok(!classes.some((c: any) => c.name === 'Hidden'));
	});
});
