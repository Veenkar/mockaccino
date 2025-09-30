class Preprocessor
{
	private input: string;

	constructor(input: string) {
		this.input = input;
	}

	get(): string {
		return this.input;
	}

	filterByRoundBraces(): Preprocessor {
		const parts = this.input.split(';');
		const filtered = parts
			.map(str => str.trim())
			.filter(str => {
				return str.includes('(') && str.includes(')');
			});
		this.input = filtered.join(';\n');
		if (this.input.length > 0) {
			this.input += ';\n';
		}
		return this;
	}

	removeComments(){
		this.removeCompoundExpressions('/*', '*/');
		this.input = this.input
			.split('\n')
			.map(line => {
				const idx = line.indexOf('//');
				return idx !== -1 ? line.slice(0, idx) : line;
			})
			.join('\n');
		return this;
	}

	removeCompoundExpressions(left_brace: string = '{', right_brace: string = '}'): Preprocessor {
		let result = '';
		const stack: number[] = [];
		let i = 0;
		while (i < this.input.length) {
			// Check for left_brace
			if (this.input.substr(i, left_brace.length) === left_brace) {
				stack.push(i);
				if (stack.length === 1) {
					result += ';';
				}
				i += left_brace.length;
				continue;
			}
			// Check for right_brace
			if (this.input.substr(i, right_brace.length) === right_brace) {
				if (stack.length === 1) {
					// Skip content inside outermost braces
				}
				stack.pop();
				i += right_brace.length;
				continue;
			}
			if (stack.length === 0) {
				result += this.input[i];
			}
			i++;
		}
		this.input = result;
		return this;
	}

	mergeLineEscapes(): Preprocessor {
		// Merge lines ending with backslash (optionally followed by whitespace) and newline
		this.input = this.input.replace(/\\[ \t]*\r?\n/g, '');
		return this;
	}

	removeIncludeDirectives(): Preprocessor {
		this.input = this.input
			.split('\n')
			.filter(line => !/^\s*#(include|pragma)\b/.test(line))
			.join('\n');
		return this;
	}

	preprocess(): Preprocessor {
		this.mergeLineEscapes();
		this.removeIncludeDirectives();
		// Simple C preprocessor implementation for #define, #ifdef, #if, #elif, #else
		const lines = this.input.split('\n');
		const macros: Record<string, any> = {};
		const output: string[] = [];
		const stack: Array<{active: boolean, elseUsed: boolean}> = [];
		const evalExpr = (expr: string): boolean => {
			// Replace macro names with their values
			const replaced = expr.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (m) => {
				if (macros[m] !== undefined && typeof macros[m] === 'string') return macros[m];
				if (macros[m] !== undefined && typeof macros[m] === 'boolean') return macros[m] ? '1' : '0';
				return m;
			});
			try {
				// Only allow safe expressions
				return !!Function(`"use strict";return (${replaced})`)();
			} catch {
				return false;
			}
		};
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (line.startsWith('#define')) {
				const macroMatch = line.match(/^#define\s+([A-Za-z_][A-Za-z0-9_]*)(\(([^)]*)\))?\s+(.*)$/);
				if (macroMatch) {
					const [, name, , params, body] = macroMatch;
					if (params !== undefined) {
					 // Function-like macro
						const paramList = params.split(',').map(p => p.trim());
						macros[name] = {params: paramList, body};
					} else {
						// Replacement macro
						macros[name] = body;
					}
				} else {
					// Variadic macro
					const variadicMatch = line.match(/^#define\s+([A-Za-z_][A-Za-z0-9_]*)\(([^)]*\.{3}[^)]*)\)\s+(.*)$/);
					if (variadicMatch) {
						const [, name, params, body] = variadicMatch;
						const paramList = params.split(',').map(p => p.trim());
						macros[name] = {params: paramList, body, variadic: true};
					}
				}
				continue;
			}
			if (line.startsWith('#ifdef')) {
				const macro = line.slice(6).trim();
				stack.push({active: !!macros[macro], elseUsed: false});
				continue;
			}
			if (line.startsWith('#ifndef')) {
				const macro = line.slice(7).trim();
				stack.push({active: !macros[macro], elseUsed: false});
				continue;
			}
			if (line.startsWith('#if')) {
				const expr = line.slice(3).trim();
				stack.push({active: evalExpr(expr), elseUsed: false});
				continue;
			}
			if (line.startsWith('#elif')) {
				if (stack.length) {
					const expr = line.slice(5).trim();
					const top = stack[stack.length - 1];
					if (!top.active && !top.elseUsed) {
						top.active = evalExpr(expr);
					}
				}
				continue;
			}
			if (line.startsWith('#else')) {
				if (stack.length) {
					const top = stack[stack.length - 1];
					if (!top.elseUsed) {
						top.active = !top.active;
						top.elseUsed = true;
					}
				}
				continue;
			}
			if (line.startsWith('#endif')) {
				stack.pop();
				continue;
			}
			// Only output if all stack levels are active
			if (stack.every(s => s.active)) {
				// Macro replacement
				let replacedLine = line;
				// Replace function-like macros
				for (const key in macros) {
					const macro = macros[key];
					if (typeof macro === 'object' && macro.params) {
						const fnRegex = new RegExp(`\\b${key}\\s*\\(([^)]*)\\)`, 'g');
						replacedLine = replacedLine.replace(fnRegex, (match, argsStr) => {
							const args = argsStr.split(',').map((a: string) => a.trim());
							let body = macro.body;
							macro.params.forEach((p: string, idx: number) => {
								const argVal = args[idx] !== undefined ? args[idx] : '';
								body = body.replace(new RegExp(`\\b${p}\\b`, 'g'), argVal);
							});
							if (macro.variadic) {
								const variadicArg = args.slice(macro.params.length).join(', ');
								body = body.replace(/\b__VA_ARGS__\b/g, variadicArg);
							}
							return body;
						});
					}
				}
				// Replace simple macros
				for (const key in macros) {
					const macro = macros[key];
					if (typeof macro === 'string') {
						replacedLine = replacedLine.replace(new RegExp(`\\b${key}\\b`, 'g'), macro);
					}
				}
				output.push(replacedLine);
			}
		}
		this.input = output.join('\n');
		return this;
	}
}

if(typeof module == "object")
	module.exports = Preprocessor;
