# Change Log

All notable changes to the "mockaccino" extension are documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## [Unreleased]

### Added

- **`mockHeaderExtension` setting** — choose the generated mock header's extension,
  `h` (default) or `hpp`. It drives the output filename, the include-guard suffix
  (`_H` / `_HPP`), and the `#include` in the generated `_mock` source.

### Changed

- **Single mock header.** The `mock` command now writes all mock declarations into
  one `_mock.h` instead of a separate `_mock.hpp` for C++ classes. A file with both
  C free functions and C++ interfaces produces one header (C mock class + gmock
  class mocks) plus the C wrapper `_mock.cc`; a pure-C++ interface file produces just
  `_mock.h`. The original header is included via `#ifdef __cplusplus`-guarded
  `extern "C"` for pure-C inputs, or a plain `#include` once C++ classes are present.

## [2.0.0] - 2026-06-15

### Added

- **Clang parser backend** — `Mockaccino: mock/stub current file (clang)`. Hands
  the source to `clang -ast-dump=json` (fed on stdin, so unsaved edits and
  sibling `#include`s both work) and mocks only the functions declared in the
  opened file. New settings: `clangPath`, `includeDirectories`,
  `clangSystemHeaderPaths`, `clangExtraArgs`. Also reads include paths from the
  C/C++ extension (`C_Cpp.default.includePath` and `.vscode/c_cpp_properties.json`).
- **AI parser backend** — `Mockaccino: mock/stub current file (AI parser)`. Asks a
  language model to extract the function list wherever the regex backend uses a
  regular expression, sharing the regex backend's tolerance for non-compiling
  input. Model source is configurable (`ai.preferredModelSource`: `sampling` /
  `vscodeLm` / `claudeCli`) with automatic fallback and reporting of the source
  actually used. New settings: `ai.inputMode`, `ai.preferredModelSource`,
  `ai.enableClaudeCli`, `ai.claudePath`, `ai.claudeArgs`.
- **MCP server** — an in-process server (in the extension host) exposing
  `generate_mock` / `generate_stub` tools to AI clients, mirroring the palette
  (backend `regex` / `clang` / `ai`, optional `path` and `outputDir`). Results
  report the written paths, output directories, and comment-stripped key content.
  Copilot agent mode auto-discovers it; the `Mockaccino: add MCP server to Claude
  Code (.mcp.json)` command wires it into Claude Code. New settings:
  `mcp.enabled`, `mcp.port`, `mcp.enableClangBackend`, `mcp.enableAiBackend`
  (regex is always available over MCP; clang and ai are gated).
- **C++ class (gmock) mocking** — the `mock` command now also generates gmock mock
  classes (`_mock.hpp`) for C++ interfaces in the same file, alongside the C
  function mocks. Supports namespaces, nested classes, and `const`/`noexcept`/
  `override` methods. New settings: `cpp.enabled`, `cpp.onlyVirtualOrInterfaceClasses`,
  `cpp.interfaceNamePatterns`, `cpp.flattenNamespaces`.
- The generation mode is stamped into the banner of each generated mock/stub file.

### Changed

- The regex backend is the unmarked default command (`mock/stub current file`);
  the clang and AI backends are separate, suffixed commands.
- Clang diagnostics and generation errors are mirrored to a "Mockaccino" tab in
  the Terminal panel and to a matching Output channel.
