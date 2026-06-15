/* Renders a gmock mock *class* from an extracted CppClass (the C++ counterpart of
   function_stringifier.ts). Each selected interface becomes a flat, global-namespace
   class deriving from the fully-qualified base, with one MOCK_METHOD per mockable
   method. Pure/vscode-free for unit testing. */

/* gmock spec list for one method: always `override`, `const` first when the method is
   const, `noexcept` last when declared noexcept — e.g. "(const, override, noexcept)". */
function methodSpecs(method: any): string {
	const specs: string[] = [];
	if (method.isConst) {
		specs.push('const');
	}
	specs.push('override');
	if (method.isNoexcept) {
		specs.push('noexcept');
	}
	return specs.join(', ');
}

function stringifyMockMethod(method: any): string {
	return `\tMOCK_METHOD(${method.returnType}, ${method.name}, (${method.paramTypes}), (${methodSpecs(method)}));`;
}

/* The bare `class <name> : public <base> { ... };` block. */
function renderClassBlock(mockClassName: string, baseType: string, methods: any[]): string {
	return [
		`class ${mockClassName} : public ${baseType} {`,
		`public:`,
		methods.map(stringifyMockMethod).join('\n'),
		`};`,
	].join('\n');
}

/* One mock class block. With `flatten` (default) the mock is a global-namespace
   class whose name encodes the full scope and whose base is fully qualified
   (`app_Outer_Inner_Mock : public app::Outer::Inner`). With flatten off, the mock
   mirrors the source namespaces — wrapped in `namespace app::… { … }` with a base
   relative to that namespace; nested classes still flatten their class path into the
   name (`Outer_Inner_Mock : public Outer::Inner`), since a class can't be reopened. */
function stringifyMockClass(cppClass: any, flatten: boolean = true): string {
	if (flatten || !cppClass.namespaces || cppClass.namespaces.length === 0) {
		const flatName = cppClass.mockClassName
			|| [...(cppClass.namespaces || []), ...(cppClass.classPath || [cppClass.name])].join('_') + '_Mock';
		const base = cppClass.qualifiedName;
		return renderClassBlock(flatName, base, cppClass.methods);
	}
	const ns = cppClass.namespaces.join('::');
	const name = cppClass.classPath.join('_') + '_Mock';
	const base = cppClass.classPath.join('::');
	return [
		`namespace ${ns} {`,
		``,
		renderClassBlock(name, base, cppClass.methods),
		``,
		`} // namespace ${ns}`,
	].join('\n');
}

/* All selected classes, blank-line separated (the template's ${mock_classes}). */
function stringifyMockClasses(classes: any[], flatten: boolean = true): string {
	return classes.map((c) => stringifyMockClass(c, flatten)).join('\n\n');
}

if (typeof module === "object") {
	module.exports = { stringifyMockClasses, stringifyMockClass, stringifyMockMethod, methodSpecs };
}
