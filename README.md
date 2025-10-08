# MOCKACCINO

Gtest mock generators for C-files.

Generates a mock header and source file with mocked methods from the original file.

The header also contains a C++ class that has mocked methods with the same name and signatures as the original functions.

In the generated mock source file (filename_mock.cc), all the calls to the stubbed C functions functions lead to the respective mock methods inside the class.
This allows easy C function mocking with gtest.


## Installation
Download the extension from VS Code marketplace:

https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino


## Usage
To use Mockaccino:
 - Install the extension from VS Code marketplace.
 - Open a C source or heder file.
 - Use COMMAND PALETTE -> "Mockaccino: mock current file".
 - The mock files will be generated in the same folder that have _mock appended to their name.

This way, a pair of a header and a C++ source file are generated that can be used to mock the C code using gtest.

## Parsing Mechanism
The preprocessor directives contained in the original file as well as in the prepended preprocessor directives from the settings of this extension are processed before parsing the file.

In the current version the real include files are not parsed.
This is not required because this extensions is using regex to parse the files, not relying on an AST generated from a true language parser.
Because of this, Mockaccino does not need to know any type identifiers before parsing the original functions.

Moreover, all the unnecessary content from the input files is removed prior to regex matching.
This way, Mockaccino does not even need to parse this part of input files, which is useless from the mock generation perspective.



## Configuration
In settings of this extension it is possible to configure predefined preprocessor macros that can be used with each file to help with parsing modifiers unknown to Mockaccino.

Also a copyright notice for the generated files can be set.




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
- Allow processing of empty defines (currently empty define must have something, e.g. semicolon)
- Correct parsing when unknown function-like macros are used in function return type definition.
- Allow skipping static functions when parsing C file
- Add reading of preprocessor statements from included files.
- Add a configuration option (per project) to read include paths.
- Add support for generating mock classes for C++ methods.


## Development history
- Two parsing methods have been implemented, but currently only the stable one is used: Regex
- The other parsing method is AST based on cparser javascript project, but it did not support full C syntax and refused to parse unknown types (that would be declared in another header)
- Due to change in the main algorithm the code has been refactored to allow implementing other parsing methods.
- Should be relatively easy to generate other input (e.g. stubs) based on the current parsed objects and changing only generators

## VS Code marketplace
https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino

## Github
https://github.com/Veenkar/mockaccino

## Contact e-mail
veenkar@gmail.com

# License
Licensed using GNU GPL v3
