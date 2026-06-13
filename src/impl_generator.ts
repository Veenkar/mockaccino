var RegexParserLib = require("./regex_parser");
var RegexParser = RegexParserLib.RegexParser;
var RegexParserToolbox = RegexParserLib.RegexParserToolbox;

/* Generates the C function-wrapper implementation bodies (the .cc strings) that
   delegate to the mock instance or print stub info. Depends only on a parser and
   the few name strings it needs, not on the whole Mockaccino orchestrator (SRP/DIP). */
class ImplGenerator {
	constructor(
		private regexParser: typeof RegexParser,
		private caps_mock_name: string,
		private caps_stub_name: string,
		private mock_instance_name: string,
	) {}

	getMockImplStrings(processArgumentsFunction: (args: string) => string = RegexParserToolbox.defaultProcessArguments): string[] {
		const mock_decl_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			/* <--- SOURCE TEMPLATE */
			`${fn.returnType} ${fn.name}(${fn.arguments})`,
			/* <--- SOURCE TEMPLATE */
		processArgumentsFunction);

/* SOURCE TEMPLATE ---> */
		const mock_call_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
`
{
	${this.caps_mock_name}_ASSERT_INSTANCE_EXISTS();
	return ${this.mock_instance_name}->${fn.name}(${fn.arguments});
}
`, RegexParserToolbox.extractArgumentName_ProcessArguments);
/* <--- END SOURCE TEMPLATE */

		return this.zip(mock_decl_strs, mock_call_strs);
	}

	getStubImplStrings(processArgumentsFunction: (args: string) => string = RegexParserToolbox.removeArgumentName_ProcessArguments): string[] {
		const mock_decl_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			/* <--- SOURCE TEMPLATE */
			`${fn.returnType} ${fn.name}(${fn.arguments})`,
			/* <--- SOURCE TEMPLATE */
		processArgumentsFunction);

		const mock_call_strs = this.regexParser.getFunctionStrings((fn: FunctionInfo) =>
			{
				var return_type = fn.returnType;
				/* handle implicit return type */
				if (!return_type) {
					return_type = "int";
				}

				var return_statement = `\n\treturn static_cast<${fn.returnType}>(0);`;
				if (return_type.indexOf('*') !== -1)
				{
					return_statement = "\n\treturn nullptr;";
				}
				else if (return_type === "void")
				{
					return_statement = "";
				}
				else
				{
					/* nothing */
				}

/* SOURCE TEMPLATE ---> */
return `
{
	${this.caps_stub_name}_PRINT_INFO();${return_statement}
}
`;
/* <--- END SOURCE TEMPLATE */

			});

		return this.zip(mock_decl_strs, mock_call_strs);
	}

	/* Pair each declaration with its body, position by position. */
	private zip(decls: string[], bodies: string[]): string[] {
		const zipped: string[] = [];
		for (let i = 0; i < Math.min(decls.length, bodies.length); i++) {
			zipped.push(`${decls[i]}${bodies[i]}`);
		}
		return zipped;
	}
}

if (typeof module === "object") {
	module.exports = ImplGenerator;
}
