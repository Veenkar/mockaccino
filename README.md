# mockaccino README

Gtest mock generators for C-files.
Generates a mock header and source file with mocked methods from the original file.
The header also contains a C++ class that has mocked methods with the same name and signatures as the original functions.
In the generated mock source file (filename_mock.cc), all the calls to the stubbed C functions functions lead to the respective mock methods inside the class.
This allows easy C function mocking with gtest.

## Features

Written in pure TS/JS.

