
interface FunctionInfo {
	returnType: string | undefined;
	name: string;
	arguments: string;
	is_static: boolean;
	is_extern: boolean;
}

interface ParserConfig {
	skip_functions_with_implicit_return_type: boolean;
	skip_static_functions: boolean;
	skip_extern_functions: boolean;
	ignored_function_names: string[];
}