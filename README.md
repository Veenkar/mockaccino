# MOCKACCINO

Gtest mock generators for C-files.

Generates a mock header and source file with mocked methods from the original file.

The header also contains a C++ class that has mocked methods with the same name and signatures as the original functions.

In the generated mock source file (filename_mock.cc), all the calls to the stubbed C functions functions lead to the respective mock methods inside the class.
This allows easy C function mocking with gtest.


## Usage
Use COMMAND PALETTE -> "Mockaccino: mock current file" to generate mock files in the same folder that have _mock appended to their name. This way a pair of a header and C++ source file are generated that can be used to mock the C code using gtest.

In settings of this extension it is possible to configure predefined preprocessor macros that can be used with each file to help with parsing modifiers unknown to Mockaccino.

In the current version the real include files are not parsed, but the preprocessor directives contained in the file as wel as in the settings, from which the mocks were generated is processed.


## Features
- Does not have any external dependencies or any other external parser or compiler.
- Written in pure TypeScript!
- No search for or reading of the included headers is required, as the syntax parsing is based on regex.
- Preprocessor handling is supported, so preprocessor directives from the current file are interpreted correctly
- Unmeaningful content is removed prior to performing parsing (e.g. contents of functions)
- Since parsing does not involve AST, this extension does not have to be able to compile the file by parsing all the includes.
- Regex parsing also gives possibility for parsing unusual C dialects, as it does not have to understand non-standard modifiers.
- If the file that was used for generation compiles, the tests should also compile with gmock.
- Possiblity to configure copyright statement
- Adding custom defines before parsing the source code
- Possibility to generate mocks from both source and header files.



## TODO:
- Correct parsing when unknown function-like macros are used in function return type definition.
- Remove static keyword when parsing C source files with function implementations.
- Add support for one-line functions (without compound expressions)
- Add reading of preprocessor statements from included files.
- Add configuration.
- Add a configuration option (per project) to read include paths.
- Add possible preprecoessor pattterns that are included in every parser file that can be set in configuration. of this extension
- Add support for generating mock classes for C++ methods.


## Development history
- 100% vibe coded
- Two parsing methods have implemented, but currently only the stable one is used: Regex
- The other parsing method is AST based on cparser javascript project, but it did not support full C syntax and refused to parse unknown types (that would be declared in another header)
- Due to change in the main algorithm the code has been refactored to allow implementing other parsing methods.


## License
Licensed using GNU GPL v3
