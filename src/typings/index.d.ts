
interface FunctionInfo {
	returnType: string | undefined;
	name: string;
	arguments: string;
	is_static: boolean;
	is_extern: boolean;
}

/* The three argument projections a backend derives from one function's
   arguments, ready to drop into the generated source. Each backend builds this
   its own way (RegexParser from the raw argument text, the clang backend from
   structured params); FunctionStringifier then picks the right field per output.
     - types     : types only,       e.g. "int, const char *"
     - signature : types with names,  e.g. "int a, const char *b"
     - names     : names only,        e.g. "a, b" */
interface ProjectedArgs {
	types: string;
	signature: string;
	names: string;
}

interface ParserConfig {
	skip_functions_with_implicit_return_type: boolean;
	skip_static_functions: boolean;
	skip_extern_functions: boolean;
	ignored_function_names: string[];
}