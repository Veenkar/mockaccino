var CppParserPreprocessor = require("./preprocessor");
var CppParserToolbox = require("./regex_parser");

/* Heuristic C++ class extractor for the gmock mock-class path. The C function
   pipeline parses free declarations; this instead walks the source as a brace-depth
   scope stack so it can find classes/structs nested inside namespaces and other
   classes, attribute each method to its *innermost* enclosing class, and build a
   fully-qualified name (e.g. "app::Outer::Inner") for the mock's base type.

   It is deliberately heuristic (regex/scope walking, no compiler) and vscode-free,
   so it is unit-testable and works without a toolchain. gmock can only override
   virtual methods, so only `virtual` (incl. pure) non-`final` methods are recorded;
   templated classes/methods and operator overloads are skipped (MVP). The clang
   backend supplies an AST-based extractor with the same output shape. */

interface CppMethod {
	returnType: string;
	name: string;
	paramTypes: string;   // projected to types-only, ready for MOCK_METHOD
	isConst: boolean;
	isPure: boolean;
	isNoexcept: boolean;
}

interface CppClass {
	name: string;            // simple name, e.g. "Inner"
	qualifiedName: string;   // e.g. "app::Outer::Inner"
	mockClassName: string;   // flat name, e.g. "app_Outer_Inner_Mock"
	namespaces: string[];    // enclosing namespace frames, e.g. ["app"]
	classPath: string[];     // class-nesting frames incl. self, e.g. ["Outer", "Inner"]
	isAbstract: boolean;     // has at least one pure-virtual method
	methods: CppMethod[];
}

interface Frame {
	kind: 'namespace' | 'class' | 'block';
	name: string;
	cls?: CppClass;          // set when kind === 'class' and the class is emitted
}

/* Turn a qualified name into the flat, global-namespace mock class name. */
function mockClassNameFor(qualifiedName: string): string {
	return qualifiedName.replace(/::/g, '_') + '_Mock';
}

/* Project a raw C++ parameter list to types-only text for MOCK_METHOD, stripping
   default values first (the regex toolbox handles name removal / arrays / pointers). */
function projectParamTypes(rawParams: string): string {
	const noDefaults = rawParams
		.split(',')
		.map((p) => p.replace(/=.*$/, '').trim())
		.join(', ');
	return CppParserToolbox.RegexParserToolbox.removeArgumentName_ProcessArguments(noDefaults);
}

/* Parse one class-member statement into a mockable method, or return null when it is
   not a virtual method we can mock (non-virtual, destructor, constructor, operator,
   templated, etc.). `enclosingClassName` lets us drop constructors. */
function parseMethod(rawStmt: string, enclosingClassName: string): CppMethod | null {
	let stmt = rawStmt
		.replace(/\[\[[\s\S]*?\]\]/g, ' ')          // drop [[attributes]]
		.replace(/^\s*(public|private|protected)\s*:/, ' ')
		.trim();
	if (!stmt) {
		return null;
	}
	if (/\btemplate\b/.test(stmt) || /\boperator\b/.test(stmt) || /\bstatic\b/.test(stmt)) {
		return null;  // templated / operator / static members can't be gmock-overridden
	}

	const isVirtual = /\bvirtual\b/.test(stmt) || /\boverride\b/.test(stmt);
	if (!isVirtual) {
		return null;
	}
	if (/\bfinal\b/.test(stmt)) {
		return null;  // final can't be overridden
	}

	const isPure = /=\s*0\s*$/.test(stmt);
	const isNoexcept = /\bnoexcept\b/.test(stmt);

	// Locate the (first) top-level parameter list.
	const open = stmt.indexOf('(');
	if (open === -1) {
		return null;  // not a function
	}
	let depth = 0;
	let close = -1;
	for (let i = open; i < stmt.length; i++) {
		if (stmt[i] === '(') { depth++; }
		else if (stmt[i] === ')') { depth--; if (depth === 0) { close = i; break; } }
	}
	if (close === -1) {
		return null;
	}
	const head = stmt.slice(0, open);
	const rawParams = stmt.slice(open + 1, close);
	const tail = stmt.slice(close + 1);

	// const qualifier applies only after the parameter list (not a return-type const).
	const isConst = /\bconst\b/.test(tail);

	// Strip specifiers from the head, then name = last identifier, returnType = rest.
	const cleanHead = head.replace(/\b(virtual|static|inline|explicit)\b/g, ' ').trim();
	const nameMatch = cleanHead.match(/([A-Za-z_]\w*)\s*$/);
	if (!nameMatch) {
		return null;
	}
	const name = nameMatch[1];
	if (name.startsWith('~') || name === enclosingClassName) {
		return null;  // destructor or constructor
	}
	const returnType = cleanHead.slice(0, cleanHead.length - name.length).trim();
	if (!returnType) {
		return null;  // constructors/destructors have no return type; nothing to mock
	}

	return {
		returnType,
		name,
		paramTypes: projectParamTypes(rawParams),
		isConst,
		isPure,
		isNoexcept,
	};
}

/* Decide what an opening brace introduces, from the text accumulated before it and
   the enclosing frame stack (which supplies the namespace + class-nesting scope). */
function classifyOpen(buffer: string, stack: Frame[]): Frame {
	const text = buffer.replace(/\[\[[\s\S]*?\]\]/g, ' ').trim();

	// A namespace (incl. C++17 `namespace a::b` and anonymous `namespace {`).
	const ns = text.match(/(?:^|\s)namespace\b\s*([\w:]*)\s*$/);
	if (ns) {
		return { kind: 'namespace', name: ns[1] || '' };
	}

	// A class/struct definition: the keyword, a name, no parameter list (which would
	// make it a function), and not a templated class (out of MVP scope).
	const cls = text.match(/(?:^|\s)(?:class|struct)\s+([A-Za-z_]\w*)\b/);
	if (cls && text.indexOf('(') === -1 && !/\btemplate\b/.test(text)) {
		const name = cls[1];
		const namespaces = stack.filter((f) => f.kind === 'namespace' && f.name).map((f) => f.name);
		const parentClassPath = stack.filter((f) => f.kind === 'class').map((f) => f.name);
		const classPath = [...parentClassPath, name];
		const qualifiedName = [...namespaces, ...classPath].join('::');
		const cppClass: CppClass = {
			name,
			qualifiedName,
			mockClassName: mockClassNameFor(qualifiedName),
			namespaces,
			classPath,
			isAbstract: false,
			methods: [],
		};
		return { kind: 'class', name, cls: cppClass };
	}

	// Anything else (function body, enum, union, control block) is an opaque block.
	return { kind: 'block', name: '' };
}

/* Extract every mockable class from C++ source. Comments/preprocessor lines are
   stripped first (the scope walker needs clean braces); function bodies are walked as
   opaque blocks so their inner braces don't confuse the depth tracking. */
function extractCppClasses(source: string): CppClass[] {
	const cleaned = new CppParserPreprocessor(source)
		.mergeLineEscapes()
		.removeComments()
		.removePreprocessorDirectives()
		.get();

	const classes: CppClass[] = [];
	const stack: Frame[] = [];
	let buffer = '';

	for (let i = 0; i < cleaned.length; i++) {
		const ch = cleaned[i];
		if (ch === '{') {
			const top = stack[stack.length - 1];
			// An inline method body inside a class: record the method, then treat the
			// body as an opaque block.
			if (top && top.kind === 'class' && buffer.indexOf('(') !== -1) {
				const method = parseMethod(buffer, top.name);
				if (method) {
					top.cls!.methods.push(method);
				}
				stack.push({ kind: 'block', name: '' });
			} else {
				const frame = classifyOpen(buffer, stack);
				if (frame.kind === 'class') {
					classes.push(frame.cls!);
				}
				stack.push(frame);
			}
			buffer = '';
		} else if (ch === '}') {
			stack.pop();
			buffer = '';
		} else if (ch === ';') {
			const top = stack[stack.length - 1];
			if (top && top.kind === 'class' && buffer.indexOf('(') !== -1) {
				const method = parseMethod(buffer, top.name);
				if (method) {
					top.cls!.methods.push(method);
				}
			}
			buffer = '';
		} else {
			buffer += ch;
		}
	}

	for (const c of classes) {
		c.isAbstract = c.methods.some((m) => m.isPure);
	}
	// Drop classes that yielded no mockable methods — nothing to override.
	return classes.filter((c) => c.methods.length > 0);
}

if (typeof module === "object") {
	module.exports = { extractCppClasses, mockClassNameFor, projectParamTypes, parseMethod };
}
