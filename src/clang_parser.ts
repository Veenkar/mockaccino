const { spawnSync } = require("child_process");
const clangParserPath = require("path");
const clangCppNaming = require("./cpp_class_parser");

/* A function declaration extracted from clang's JSON AST. Unlike the regex
   backend's FunctionInfo (which carries arguments as one text blob), this keeps
   parameters structured — clang gives us each type and name — so the argument
   projections (types-only / types+names / names-only) are trivial and correct. */
interface ClangFunction {
	returnType: string;
	name: string;
	params: { type: string; name: string }[];
	is_static: boolean;
	is_extern: boolean;
	is_variadic: boolean;
}

/* Parse outcome: the functions found plus clang's own diagnostics. With
   -ferror-limit=0 clang still emits an AST for the parts it could parse even when
   there are errors, so `diagnostics` (stderr) and a non-zero `status` let the
   caller warn the user that the result may be incomplete. */
interface ClangParseResult {
	functions: ClangFunction[];
	diagnostics: string;
	status: number;
}

/* Runs `clang -ast-dump=json` over the source (fed on stdin so unsaved editor
   content is honoured and `#include "sibling.h"` resolves against the file's own
   directory) and pulls out the function declarations physically located in the
   target translation unit. Includes are parsed for type resolution but their
   declarations are filtered out — we only mock what the opened file declares. */
class ClangParser {
	constructor(
		private clangPath: string,
		private compilerArgs: string[],
	) {}

	/* fsPath is used only to set the working directory for include resolution and
	   for diagnostics; the actual bytes come from `content` via stdin. */
	parse(content: string, fsPath: string): ClangParseResult {
		const args = [
			'-Xclang', '-ast-dump=json',
			'-fsyntax-only',
			'-ferror-limit=0',
			'-x', 'c',
			...this.compilerArgs,
			'-', // read the translation unit from stdin
		];
		const res = spawnSync(this.clangPath, args, {
			input: content,
			cwd: clangParserPath.dirname(fsPath),
			encoding: 'utf8',
			maxBuffer: 256 * 1024 * 1024,
		});
		if (res.error) {
			throw new Error(`Failed to run clang at '${this.clangPath}': ${res.error.message}`);
		}
		const diagnostics: string = res.stderr || '';
		if (!res.stdout || res.stdout.trim().length === 0) {
			// No AST at all — a fatal parse (e.g. an unresolved include) or a bad
			// clang. Surface clang's own diagnostics in the error.
			throw new Error(`clang produced no AST output (exit ${res.status}).\n${diagnostics || '(no diagnostics)'}`);
		}
		let ast: any;
		try {
			ast = JSON.parse(res.stdout);
		} catch (e: any) {
			throw new Error(`Could not parse clang JSON AST: ${e.message}`);
		}
		return {
			functions: ClangParser.extractTargetFunctions(ast),
			diagnostics,
			status: typeof res.status === 'number' ? res.status : 0,
		};
	}

	/* Top-level FunctionDecls that belong to the main (stdin) file. clang only
	   emits `loc.file` when it changes between sibling nodes, so we carry the
	   last-seen file forward; the main translation unit is reported as <stdin>. */
	static extractTargetFunctions(ast: any): ClangFunction[] {
		const functions: ClangFunction[] = [];
		let currentFile = '<stdin>';
		for (const node of ast.inner || []) {
			if (node.loc && typeof node.loc.file === 'string') {
				currentFile = node.loc.file;
			}
			if (node.kind !== 'FunctionDecl' || node.isImplicit) {
				continue;
			}
			if (!ClangParser.isMainFile(currentFile) || !node.name) {
				continue; // declared in an included header, or anonymous — skip
			}
			const qualType: string = (node.type && node.type.qualType) || '';
			const params = (node.inner || [])
				.filter((c: any) => c.kind === 'ParmVarDecl')
				.map((p: any) => ({ type: (p.type && p.type.qualType) || '', name: p.name || '' }));
			functions.push({
				returnType: ClangParser.returnTypeOf(qualType),
				name: node.name,
				params,
				is_static: node.storageClass === 'static',
				is_extern: node.storageClass === 'extern',
				is_variadic: /\.\.\.\s*\)\s*$/.test(qualType),
			});
		}
		return functions;
	}

	static isMainFile(file: string): boolean {
		return file === '<stdin>';
	}

	/* C++ class extraction (the gmock mock-class path). A second clang pass with
	   `-x c++` produces the AST; extractCppClasses walks namespaces/records for the
	   mockable virtual methods. Parse failures yield [] (the C-function path is
	   independent and still reports its own clang diagnostics). */
	parseClasses(content: string, fsPath: string): any[] {
		const args = [
			'-Xclang', '-ast-dump=json',
			'-fsyntax-only',
			'-ferror-limit=0',
			'-x', 'c++',
			...this.compilerArgs,
			'-',
		];
		const res = spawnSync(this.clangPath, args, {
			input: content,
			cwd: clangParserPath.dirname(fsPath),
			encoding: 'utf8',
			maxBuffer: 256 * 1024 * 1024,
		});
		if (res.error || !res.stdout || res.stdout.trim().length === 0) {
			return [];
		}
		let ast: any;
		try {
			ast = JSON.parse(res.stdout);
		} catch {
			return [];
		}
		return ClangParser.extractCppClasses(ast);
	}

	/* Walk the C++ AST for mockable classes: every CXXRecordDecl defined in the main
	   (stdin) translation unit, with its fully-qualified scope, keeping only virtual,
	   non-final methods (constructors/destructors are distinct node kinds and are
	   excluded automatically). Same output shape as the regex extractor. */
	static extractCppClasses(ast: any): any[] {
		const classes: any[] = [];

		const methodFrom = (member: any): any | null => {
			if (member.isImplicit || member.storageClass === 'static') {
				return null;
			}
			const isVirtual = member.virtual === true
				|| (member.inner || []).some((a: any) => a.kind === 'OverrideAttr');
			if (!isVirtual) {
				return null;
			}
			if ((member.inner || []).some((a: any) => a.kind === 'FinalAttr')) {
				return null;
			}
			const name: string = member.name || '';
			if (!name || name.startsWith('~') || /\boperator\b/.test(name)) {
				return null;
			}
			const qualType: string = (member.type && member.type.qualType) || '';
			const afterParams = ClangParser.afterParamList(qualType);
			const params = (member.inner || [])
				.filter((c: any) => c.kind === 'ParmVarDecl')
				.map((p: any) => (p.type && p.type.qualType) || '');
			return {
				returnType: ClangParser.returnTypeOf(qualType),
				name,
				paramTypes: params.join(', '),
				isConst: /\bconst\b/.test(afterParams),
				isPure: member.pure === true,
				isNoexcept: /\bnoexcept\b/.test(afterParams) || member.exceptionSpec === 'noexcept',
			};
		};

		const walk = (nodes: any[], namespaces: string[], classScope: string[], file: string) => {
			let currentFile = file;
			for (const node of nodes || []) {
				if (node.loc && typeof node.loc.file === 'string') {
					currentFile = node.loc.file;
				}
				if (node.kind === 'NamespaceDecl') {
					walk(node.inner || [], [...namespaces, node.name || ''].filter(Boolean), classScope, currentFile);
				} else if (node.kind === 'CXXRecordDecl' && node.name && Array.isArray(node.inner)) {
					const classPath = [...classScope, node.name];
					const qualifiedName = [...namespaces, ...classPath].join('::');
					const methods = node.inner
						.filter((m: any) => m.kind === 'CXXMethodDecl')
						.map(methodFrom)
						.filter((m: any) => m !== null);
					if (ClangParser.isMainFile(currentFile)) {
						classes.push({
							name: node.name,
							qualifiedName,
							mockClassName: clangCppNaming.mockClassNameFor(qualifiedName),
							namespaces,
							classPath,
							isAbstract: methods.some((m: any) => m.isPure),
							methods,
						});
					}
					walk(node.inner, namespaces, classPath, currentFile);  // nested records
				}
			}
		};

		walk(ast.inner || [], [], [], '<stdin>');
		return classes.filter((c) => c.methods.length > 0);
	}

	/* The qualType text after the top-level parameter list (where method qualifiers
	   like `const`/`noexcept` live): "int (int) const" -> " const". */
	static afterParamList(qualType: string): string {
		const open = qualType.indexOf('(');
		if (open === -1) {
			return '';
		}
		let depth = 0;
		for (let i = open; i < qualType.length; i++) {
			if (qualType[i] === '(') { depth++; }
			else if (qualType[i] === ')') { depth--; if (depth === 0) { return qualType.slice(i + 1); } }
		}
		return '';
	}

	/* Return type = the qualType text before its top-level parameter-list paren.
	   "const char *(void)" -> "const char *"; "void (int, int)" -> "void". */
	static returnTypeOf(qualType: string): string {
		let depth = 0;
		for (let i = 0; i < qualType.length; i++) {
			const c = qualType[i];
			if (c === '(') {
				if (depth === 0) {
					return qualType.slice(0, i).trim();
				}
				depth++;
			} else if (c === ')') {
				depth--;
			}
		}
		return qualType.trim();
	}
}

if (typeof module === "object") {
	module.exports = ClangParser;
}
