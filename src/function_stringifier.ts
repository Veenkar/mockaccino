/* Backend-agnostic source-string templates. Given a function's return type,
   name and a ProjectedArgs bundle (its arguments already rendered as types-only
   / types-with-names / names-only), produces the three output forms:
     - mockMethod : a MOCK_METHOD(...) header entry
     - mockImpl   : a C wrapper that forwards to the singleton mock instance
     - stubImpl   : a C wrapper that prints info and returns a safe default
   This module owns the gmock/stub *layout* and which projection each output
   uses; deriving the projections stays with each backend (RegexParser from the
   raw argument text, the clang backend from structured params), because that is
   where C declarator quirks like `char argv[]` vs `char[]` are handled. */
class FunctionStringifier {
	constructor(
		private caps_mock_name: string,
		private caps_stub_name: string,
		private mock_instance_name: string,
	) {}

	/* Header entry — argument types only. */
	mockMethod(returnType: string | undefined, name: string, args: ProjectedArgs): string {
		return `\tMOCK_METHOD(${returnType}, ${name}, (${args.types}));`;
	}

	/* Mock .cc wrapper — full signature (types + names), forwarding the names to
	   the mock instance. */
	mockImpl(returnType: string | undefined, name: string, args: ProjectedArgs): string {
		return `${returnType} ${name}(${args.signature})` + `
{
	${this.caps_mock_name}_ASSERT_INSTANCE_EXISTS();
	return ${this.mock_instance_name}->${name}(${args.names});
}
`;
	}

	/* Stub .cc wrapper — the stub ignores its arguments, so the signature is
	   types only. The return statement is chosen from the return type: nullptr for
	   pointers, nothing for void, otherwise a zero cast. */
	stubImpl(returnType: string | undefined, name: string, args: ProjectedArgs): string {
		let return_type = returnType;
		/* handle implicit return type */
		if (!return_type) {
			return_type = "int";
		}

		let return_statement = `\n\treturn static_cast<${returnType}>(0);`;
		if (return_type.indexOf('*') !== -1) {
			return_statement = "\n\treturn nullptr;";
		} else if (return_type === "void") {
			return_statement = "";
		}

		return `${returnType} ${name}(${args.types})` + `
{
	${this.caps_stub_name}_PRINT_INFO();${return_statement}
}
`;
	}
}

if (typeof module === "object") {
	module.exports = FunctionStringifier;
}
