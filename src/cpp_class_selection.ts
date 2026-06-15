/* Decides which extracted C++ classes actually get a gmock mock, from the
   `mockaccino.cpp.*` settings. Pure (vscode-free) so it is unit-testable. The parser
   already guarantees every class here has at least one mockable (virtual, non-final)
   method; this only applies the user's interface/virtual restriction on top.

   - onlyVirtualOrInterface (default true): keep a class only when it is abstract
     (has a pure-virtual method — i.e. a real interface) OR its simple name matches
     one of interfaceNamePatterns (case-insensitive substring, default ["interface"]).
   - onlyVirtualOrInterface = false: keep every class that has a mockable method. */

interface SelectionOpts {
	onlyVirtualOrInterface: boolean;
	interfaceNamePatterns: string[];
}

function nameMatchesInterface(name: string, patterns: string[]): boolean {
	const lower = name.toLowerCase();
	return (patterns || []).some((p) => p && lower.includes(String(p).toLowerCase()));
}

function selectMockClasses(classes: any[], opts: SelectionOpts): any[] {
	if (!opts.onlyVirtualOrInterface) {
		return classes;
	}
	return classes.filter(
		(c) => c.isAbstract || nameMatchesInterface(c.name, opts.interfaceNamePatterns),
	);
}

if (typeof module === "object") {
	module.exports = { selectMockClasses, nameMatchesInterface };
}
