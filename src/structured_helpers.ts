/* Shared helpers for backends that parse C into *structured* functions
   (`{ returnType, name, params: [{type, name}], is_static, is_extern, is_variadic }`)
   — currently the clang and AI backends. The regex backend keeps a text blob and
   uses RegexParserToolbox instead, so it does not use these. */

/* Derive the three FunctionStringifier argument projections from a function's
   structured params. Unnamed params get a synthesised name so the signature and
   forwarding call stay valid C; a trailing `...` is added to the types/signature
   for variadics, but not to the names (a `...` can't be forwarded by name). */
function projectArgs(fn: any): ProjectedArgs {
	const synth = (p: any, i: number) => p.name || `arg${i + 1}`;
	const types = fn.params.map((p: any) => p.type);
	const signature = fn.params.map((p: any, i: number) => `${p.type} ${synth(p, i)}`);
	const names = fn.params.map((p: any, i: number) => synth(p, i));
	if (fn.is_variadic) {
		types.push("...");
		signature.push("...");
	}
	return {
		types: types.join(", "),
		signature: signature.join(", "),
		names: names.join(", "),
	};
}

/* Apply the same config-driven filtering every backend shares: skip static/extern
   functions, drop ignored names, and dedupe by name (first wins). */
function filterFunctions(fns: any[], opts: { skipStatic?: boolean; skipExtern?: boolean; ignored?: string[] }): any[] {
	let result = fns;
	if (opts.skipStatic) {
		result = result.filter((fn) => !fn.is_static);
	}
	if (opts.skipExtern) {
		result = result.filter((fn) => !fn.is_extern);
	}
	if (opts.ignored && opts.ignored.length > 0) {
		result = result.filter((fn) => !opts.ignored!.includes(fn.name));
	}
	const seen = new Set<string>();
	return result.filter((fn) => (seen.has(fn.name) ? false : (seen.add(fn.name), true)));
}

if (typeof module === "object") {
	module.exports = { projectArgs, filterFunctions };
}
