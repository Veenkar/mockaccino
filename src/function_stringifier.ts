/* Backend-agnostic source-string templates. Given a function's return type,
   name and pre-projected argument strings, produces the three output forms the
   templates need:
     - mockMethod : a MOCK_METHOD(...) header entry
     - mockImpl   : a C wrapper that forwards to the singleton mock instance
     - stubImpl   : a C wrapper that prints info and returns a safe default
   The arg *projections* (types-only / types-with-names / names-only) are the
   caller's job, because each backend derives them differently (RegexParser from
   the raw argument text, the clang backend from structured params). Centralising
   only the formats here keeps the gmock/stub layout in one place for both. */
class FunctionStringifier {
	constructor(
		private caps_mock_name: string,
		private caps_stub_name: string,
		private mock_instance_name: string,
	) {}

	/* Header entry. `argTypes` is the comma-joined argument types (no names). */
	mockMethod(returnType: string | undefined, name: string, argTypes: string): string {
		return `\tMOCK_METHOD(${returnType}, ${name}, (${argTypes}));`;
	}

	/* Mock .cc wrapper. `signatureArgs` are the types-with-names for the C
	   signature; `callArgs` are the names-only forwarded to the mock instance. */
	mockImpl(returnType: string | undefined, name: string, signatureArgs: string, callArgs: string): string {
		return `${returnType} ${name}(${signatureArgs})` + `
{
	${this.caps_mock_name}_ASSERT_INSTANCE_EXISTS();
	return ${this.mock_instance_name}->${name}(${callArgs});
}
`;
	}

	/* Stub .cc wrapper. `signatureArgs` are the types-only (the stub ignores its
	   arguments). The return statement is chosen from the return type: nullptr for
	   pointers, nothing for void, otherwise a zero cast. */
	stubImpl(returnType: string | undefined, name: string, signatureArgs: string): string {
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

		return `${returnType} ${name}(${signatureArgs})` + `
{
	${this.caps_stub_name}_PRINT_INFO();${return_statement}
}
`;
	}
}

if (typeof module === "object") {
	module.exports = FunctionStringifier;
}
