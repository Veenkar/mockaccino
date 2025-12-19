
class RegexParser
{
	public constructor() {}
	/**
	 * Parses a C function declaration string and returns a FunctionInfo object.
	 * Example input: "int foo(char* bar, double baz)"
	 */
	public static parseFunctionDeclaration(declaration: string, skip_functions_with_implicit_return_type:boolean): FunctionInfo {

		let is_static = false;

		if (declaration && /.*static.*/.test(declaration)) {
			is_static = true;
		}

		let is_extern = false;
		if (declaration && /.*extern.*/.test(declaration)) {
			is_extern = true;
		}

		// Remove function link modifiers (extern, static) from the start
		const cleanedDecl = declaration.trim().replace(/^\s*(extern|static)\s+/i, '');

		// Match optional return type (with modifiers), function name, and arguments
		let regex = /^\s*([\w\s\*\&\[\]]*?\s+)?([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*;?\s*$/;
		if (skip_functions_with_implicit_return_type) {
			console.log("Skipping functions with implicit return type");
			regex = /^\s*([\w\s\*\&\[\]]*?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*;?\s*$/;
		}


		const match = cleanedDecl.match(regex);

		if (!match) {
			return {
				returnType: undefined,
				name: "",
				arguments: "",
				is_static: false,
				is_extern: false
			};
		}

		let [, returnType, name, args] = match;


		// Remove unwanted modifiers from returnType (keep const, volatile, etc.)
		if (returnType) {
			returnType = returnType.replace(/\b(static|extern)\b/g, '').trim();
		}

		// Handle empty arguments or 'void'
		args = args.trim();
		if (!args || args === 'void') {
			args = '';
		}

		return {
			returnType: returnType || "int",
			name: name.trim(),
			arguments: args,
			is_static: is_static,
			is_extern: is_extern
		};
	}


	static defaultStringifyFunction(fn: FunctionInfo): string {
		return `${fn.returnType} ${fn.name}(${fn.arguments});`;
	}



	/**
	 * Adds argument names to unnamed arguments in a C argument string.
	 * Splits by comma, and for each argument:
	 * - If it contains only a single valid C identifier (alphanumeric/underscore, starts with letter/underscore), or
	 * - If it ends with '*', 
	 * then appends a generated name: arg1, arg2, ...
	 * Example: "int, char*, double value" => "int arg1, char* arg2, double value"
	 */
	static fixNoNameArguments(args: string): string {
		let counter = 1;
		return args.split(',').map(arg => {
			let trimmed = arg.trim();
			// Match a single identifier (type only, no name)
			const singleIdent = /^(?:(?:const|volatile)\s+)*([a-zA-Z_][a-zA-Z0-9_]*)$/;
			// Match pointer type with no name (e.g., "char*", "const int *")
			const pointerNoName = /^(.*\*)\s*$/;
			// If already has a name, leave as is
			if (singleIdent.test(trimmed) || pointerNoName.test(trimmed)) {
				return `${trimmed} arg${counter++}`;
			}
			return trimmed;
		}).join(', ');
	}

	static defaultProcessArguments(args: string): string {
		// Handle empty arguments or 'void'
		args = args.trim();
		if (!args || args === 'void') {
			args = '';
		}
		return RegexParser.fixNoNameArguments(args);
	}

	/**
	 * static removeArgumentName_ProcessArguments(args: string): string,
	 * Does the same that defaultProcessArguments and additionally splits the arguments by comma character,
	 * removes argument name from each array element. Argument name is the last C identifier
	 * in each of those argument strings (which can be a string of alphanumeric characters and underscores that cannot start with a number).
	 * Only do the removal if there is at least one non-space character before the matched argument name.
	 * Ensure the regex string has proper explanation comments.
	 *
	 * Processes argument strings by removing argument names.
	 * Splits the arguments by comma, and for each argument, removes the last C identifier
	 * (alphanumeric/underscore, not starting with a number) if there is at least one non-space character before it.
	 * Example: "const char* str, int count" => "const char*, int"
	 */
	static removeArgumentName_ProcessArguments(args: string): string {
		// Handle empty arguments or 'void'
		args = RegexParser.defaultProcessArguments(args);
		return args.split(',')
			.map(arg => {
				arg = arg.trim();
				/**
				 * Regex explanation:
				 * ^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)$
				 * - (.*\S) : Capture group 1, any characters ending with a non-space (the type part)
				 * - \s+    : At least one whitespace between type and name
				 * - ([a-zA-Z_][a-zA-Z0-9_]*) : Capture group 2, C identifier (argument name)
				 * - $      : End of string
				 */
				const match = arg.match(/^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(\[\s*\])?\s*$/);
				if (match) {
					let res = match[1]; // Return only the type part
					if (match[3]) { // If there is an array part, add it back
						res += match[3];
					}
					return res;
				}
				return arg; // If no match, return as is
			})
			.join(', ');
	}

	static extractArgumentName_ProcessArguments(args: string): string {
		// Handle empty arguments or 'void'
		args = RegexParser.defaultProcessArguments(args);
		return args.split(',')
			.map(arg => {
				arg = arg.trim();
				/**
				 * Regex explanation:
				 * ^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)$
				 * - (.*\S) : Capture group 1, any characters ending with a non-space (the type part)
				 * - \s+    : At least one whitespace between type and name
				 * - ([a-zA-Z_][a-zA-Z0-9_]*) : Capture group 2, C identifier (argument name)
				 * - $      : End of string
				 */
				const match = arg.match(/^(.*\S)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(\[\s*\])?\s*$/);
				if (match) {
					let res = match[2]; // Return only the type part
					return res;
				}
				return arg; // If no match, return as is
			})
			.join(', ');
	}

	static parseArgs(args: any, includeName: boolean = true): string {
		function parseArg(arg: any): string {
			const mods = arg?.modifier?.filter((node: any) => node !== "static" && node.type !== "extern");
			const modifiers = mods?.length ? arg.modifier.join(' ') + ' ' : '';
			if (arg?.type === "PointerType") {
				const targetStr = RegexParser.parseArgs(arg.target, includeName);
				return `${modifiers}*${targetStr}`;
			}
			if (arg?.type === "Type") {
				return includeName && arg.name ? `${modifiers}${arg.name}`: modifiers;
			}
			if (arg?.type === "Definition") {
				if (arg.defType){
					const typeStr = RegexParser.parseArgs(arg.defType, includeName);
					return includeName && arg.name ? `${typeStr} ${arg.name}` : typeStr;
				}
			}
			return '';
		}
		return Array.isArray(args) ? args.map((arg) => parseArg(arg)).join(", ") : parseArg(args);
	}
}

if(typeof module === "object")
{
    module.exports = RegexParser;
}
