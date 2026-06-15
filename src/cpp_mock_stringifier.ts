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

/* One mock class block: `class <flat name> : public <qualified base> { ... };`. */
function stringifyMockClass(cppClass: any): string {
	const methods = cppClass.methods.map(stringifyMockMethod).join('\n');
	return [
		`class ${cppClass.mockClassName} : public ${cppClass.qualifiedName} {`,
		`public:`,
		methods,
		`};`,
	].join('\n');
}

/* All selected classes, blank-line separated (the template's ${mock_classes}). */
function stringifyMockClasses(classes: any[]): string {
	return classes.map(stringifyMockClass).join('\n\n');
}

if (typeof module === "object") {
	module.exports = { stringifyMockClasses, stringifyMockClass, stringifyMockMethod, methodSpecs };
}
