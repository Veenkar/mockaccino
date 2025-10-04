# MOCKACCINO

Gtest mock generators for C-files.

Generates a mock header and source file with mocked methods from the original file.

The header also contains a C++ class that has mocked methods with the same name and signatures as the original functions.

In the generated mock source file (filename_mock.cc), all the calls to the stubbed C functions functions lead to the respective mock methods inside the class.
This allows easy C function mocking with gtest.


## Features
- Does not have any external dependencies or any other external parser or compiler.
- Written in pure TS/JS.
- No search for or reading of the included headers is required, as the syntax parsing is based on regex.
- Preprocessor handling is supported, so preprocessor directives from the current file are interpreted correctly
- Unmeaningful content is removed prior to performing parsing (e.g. contents of functions)


## TODO:
- Add support for one-line functions (without compound expressions)
- Add reading of preprocessor statements from included files.
- Add configuration.
- Add a configuration option (per project) to read include paths.
- Add possible preprecoessor pattterns that are included in every parser file that can be set in configuration. of this extension


## Development history
- 100% vibe coded
- Two parsing methods have implemented, but currently only the stable one is used: Regex
- The other parsing method is AST based on cparser javascript project, but it did not support full C syntax and refused to parse unknown types (that would be declared in another header)
- Due to change in the main algorithm the code has been refactored to allow implementing other parsing methods.


## License
Licensed using GNU GPL v3
