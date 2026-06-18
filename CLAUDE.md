# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Mockaccino is a VS Code extension that generates C++ gmock mock and stub files from C source/header files. It uses regex-based parsing (not an AST/compiler) so it works without resolving includes or understanding custom type modifiers.

The `mock` command also generates **gmock mock classes** for C++ interfaces found in the same file, with no file-type detection: one run mocks free C functions the old way *and* C++ classes the new way. Everything lands in a **single `_mock.h`** — the C mock class (only when there are C free functions) and the gmock C++ class mocks (only when there are mockable C++ interfaces) share one header; the `.cc` is written only for the C path. Only `virtual` methods are mockable, so the class path targets abstract/interface-like classes (see the C++ class-mock pipeline below).

## Commands

```bash
npm run compile        # type-check + lint + esbuild bundle
npm run lint           # ESLint only
npm run check-types    # tsc --noEmit only
npm run package        # production build (minified)
npm run compile-tests  # compile tests to out/
npm run test           # run ALL tests inside Electron VS Code (@vscode/test-cli)
npm run test:unit      # fast: compile + run pure-module unit tests via plain mocha (no Electron)
```

Two test paths:
- **`npm run test:unit`** — compiles to `out/` then runs mocha (TDD UI) over `out/test/**/*.test.js`, excluding `extension.test.js` and `acceptance.test.js`. Covers `preprocessor`, `regex_parser`, `interpolator`, and `regex_mockaccino` (the concrete regex backend / orchestrator, driven against the real templates with `config`/`uri` mocked and output sent to a temp dir) without downloading/launching VS Code. Use this for the fast refactor loop.
- **`npm run test`** — launches a headless Electron VS Code; required for tests that import the `vscode` API: `extension.test.ts` and the **acceptance tests** (`acceptance.test.ts`).

### Acceptance tests (`src/test/acceptance.test.ts`)

End-to-end golden-file tests that run the *real* `mockaccino.mockCurrentFile` / `mockaccino.stubCurrentFile` commands inside the Electron host and compare the generated files to committed references. Data-driven and fixture-discovered, so adding a case needs no test code change.

- **Fixtures** live in `src/test/fixtures/<case>/` — one folder per input file. The single C/C++ source input (matched by extension, so a sibling `config.json` is not mistaken for it) sits at the case-folder root; its golden outputs live in `<case>/expected/` as `<name>_mock.{h,hpp}`, `<name>_mock.cc`, `<name>_stub.cc`. The mock command runs when a `_mock.{h,hpp}`/`_mock.cc` golden exists (a C++-only interface file yields just `_mock.h` — see the `iface_hpp` case; a mixed C-and-C++ file yields `_mock.h` + `_mock.cc` — see `mixed_hpp`); the stub command runs when `_stub.cc` exists.
- **`.c` vs `.h` are separate cases.** Either can be mocked/stubbed (definitions vs declarations), and the output differs (most visibly the `INPUT:` line, plus edge-case parsing), so each input file gets its own case folder and goldens (e.g. `main_c` for `main.c`, `main_h` for `main.h`).
- **Config** is pinned to the package.json defaults (the goldens were generated with defaults), pulled at runtime from `contributes.configuration.properties` and written via `ConfigurationTarget.Global`; only `outputPath` is overridden to a temp dir so generated files never overwrite the committed goldens. A case may ship an optional `config.json` (a map of `mockaccino.*` setting → value, sans the `mockaccino.` prefix) to **override** specific defaults for that case — used by `hpp_ext`, which sets `mockHeaderExtension: "hpp"` and golden-checks the `_mock.hpp` header (with `_HPP` guard) plus the matching `#include` in `_mock.cc`. Config is restored in teardown.
- **Normalization:** the three volatile values — the `TIME:` line, the `VERSION:` line, and the copyright **year** — are rewritten to placeholders on both sides before `assert.strictEqual`, plus CRLF→LF. If a comparison fails on anything else, that's a real generator change — regenerate the golden (don't widen normalization to hide it).

### Integration suite (`integration/`, mandatory — `npm run test:integration`)

A **mandatory** suite that proves generated mocks *and stubs* actually *compile and run*. It is its own script (not folded into `npm run test`/`test:unit`), and it never skips — it must actually run and pass. `node integration/run.js` (= `npm run test:integration`): compiles the extension, runs **both backends** on `integration/src/display.h` + `rng.h` to emit gmock mocks **and stubs** — `RegexMockaccino` → `integration/generated/`, `ClangMockaccino` → `integration/generated_clang/` — configures+builds a CMake project with **clang** (GoogleTest via `FetchContent`, so the first run needs network), then via `ctest` runs the test suite **once per backend** (the `unit_tests`/`stub_tests`/`mock_assert_tests` targets are built against each backend's output, so test names are prefixed `regex.*` / `clang.*`), and finally runs the real `game_of_life` binary. Because the same test sources are compiled against both backends, the two must produce **interchangeable** mocks (same class names, `MOCK_METHOD` signatures, and C-linkage symbols). It also runs a clang **error-reporting** check: a header with a deliberate type error must leave `ClangMockaccino.clangHadErrors` set and the clang diagnostics captured (what the extension shows in its "Mockaccino" terminal/output tab). Anything that stops it — a missing tool (clang/cmake/ninja/network) or a genuine build/test failure — exits non-zero.

The example program is a console Conway's Game of Life: `board`/`engine` are compiled for real (and `board` is unit-tested directly), while `display` and `rng` are the **mocked/stubbed** dependencies (their real `.c` is not linked into the tests — the generated `*_mock.cc`/`*_stub.cc` provide the C-linkage symbols). `display.h`/`rng.h` carry deliberately varied signatures to exercise Mockaccino's parsing paths. Mocks (`unit_tests`) verify interactions via `EXPECT_CALL`; stubs (`stub_tests`, a separate executable since a stub and mock can't define the same symbol in one binary) verify the stub links, returns the safe defaults, and logs its trace line (`<STUB>_PRINT_INFO()` output is checked by capturing stdout). `mock_assert_tests` covers the generated mock's runtime safety asserts (calling a mocked function with no live instance, or constructing a second instance) — those use `assert()`, which `NDEBUG` compiles out, so that target is built with assertions forced on (`-UNDEBUG` / MSVC `/UNDEBUG`) and uses gtest **death tests** to prove the guards `abort()`. Each of these targets is built twice (once per backend) via a CMake `add_backend_tests(backend gen_dir)` function. A fourth per-backend target, `cpp_mock_tests`, exercises the **C++ class-mock** path: both backends generate `sink_mock.h` from `integration/src/sink.hpp` (an abstract `metrics::ISink` interface; mock-only, since gmock classes have no stub), and `test/test_cpp_mock.cpp` drives the generated `metrics_ISink_Mock` with `EXPECT_CALL` against the real consumer `sink.cpp` — proving the class mock compiles and the regex/clang headers are interchangeable. `integration/build/`, `integration/generated/`, and `integration/generated_clang/` are gitignored. See [integration/README.md](integration/README.md).

Unit tests live in `src/test/*.test.ts` and `require()` the **compiled** sibling module (e.g. `require('../preprocessor')` → `out/preprocessor.js`), not the `.ts` source. They use mocha's TDD interface (`suite`/`test`) to match the harness. Only `extension.ts` can't be unit-tested this way — it imports the `vscode` API, which exists only inside the Electron host. (`mockaccino.ts` became testable once its internal requires were switched from the literal `require("./preprocessor.ts")` to extensionless `require("./preprocessor")`, which resolves under both esbuild and plain Node.)

To publish a new `.vsix`: `npx vsce package` (requires `vsce` globally or via npx).

## Workflow conventions

- **Always run tests after each change — no exceptions.** Run `npm run test:unit` (the fast path) after *every* change and confirm it passes before considering the change done. This applies even to changes that seem test-irrelevant (docs, config, comments) — always run them. Run `npm run test` as well when touching `extension.ts` or anything that imports the `vscode` API.
- **The integration suite is mandatory.** Run `npm run test:integration` and confirm it passes before considering a change done, in addition to the unit/Electron tests. It never skips: a missing toolchain (clang/cmake/ninja/network) or a real build/test failure exits non-zero, and none of those are acceptable.
- **Commit after each change, but do not push.** Once tests pass, commit the change with a focused message. Never `git push` — pushing is left to the user.
- **New classes go in their own file.** When introducing a new class, create a separate source file for it (mirroring the existing one-class-per-file layout) rather than appending it to an existing module, unless it is a tiny private helper tightly coupled to its host. Remember the module-system quirk below: export with `if(typeof module === "object") module.exports = ...` and import via extensionless `require("./new_file")`.

## Architecture

### Processing pipeline (on each command invocation)

The abstract `Mockaccino` base (mockaccino.ts) owns the backend-independent
half (doc metadata, naming, template context, output path, and the
`mock()`/`stub()` template methods that render + write). The backend-specific
half — preprocessing, parsing, and the three string-generation hooks
(`getMockMethodStrings`, `getMockImplStrings`, `getStubImplStrings`) — lives in a
concrete subclass. `RegexMockaccino` (regex_mockaccino.ts) is the only wired
backend; `ClangMockaccino` (clang_mockaccino.ts) is a scaffold.

```
Active editor text
  → RegexMockaccino (regex_mockaccino.ts)   ← concrete backend
    → Preprocessor         (preprocessor.ts)
        removeComments, mergeLineEscapes, removeExternC
        activateSimpleIfBlocks (optional, config-gated)
        preprocess()  ← evaluates #define/#ifdef/#if/#elif/#else/#endif
        removePreprocessorDirectives, removeCompoundExpressions (strips function bodies)
        filterByRoundBraces  ← keeps only semicolon-delimited expressions that have ()
    → getExpressions()     → string[] of candidate function declarations
    → RegexParser          (regex_parser.ts)
        parseFunctionDeclaration() per expression  → FunctionInfo[]
        filter by static/extern/ignored names/dedup
        getFunctionStrings(stringifyFn, processArgsFn) → string[]
  → Mockaccino.mock()/stub()  (mockaccino.ts)  ← shared, calls the backend hooks
    → Interpolator         (interpolator.ts)
        fills template files using JS template literal eval
    → fs.writeFileSync     → output .h / .cc files
```

### Key source files

- **[src/extension.ts](src/extension.ts)** — VS Code entry point. A shared `generate(context, BackendClass, operation, uri, content)` core constructs a backend and runs the operation (guarded with try/catch so clang failures surface as error messages); `runGeneration` feeds it the active editor and `runGenerationForFile` feeds it a picked/explorer/uri-arg file (via `pickAndReadFile`). The default commands use the **regex** backend only — `mockaccino.mockCurrentFile` / `stubCurrentFile` (active editor) and `mockaccino.mockFile` / `stubFile` (pick a file). The clang/AI backends are not separate commands; they are reached through the **"(advanced)"** commands — `mockaccino.mockCurrentFileAdvanced` / `stubCurrentFileAdvanced` and `mockaccino.mockFileAdvanced` / `stubFileAdvanced` — which `pickMethod()` (a regex/clang/AI quick-pick) then `runWithMethod` dispatches (regex/clang → `generate`; AI → the async `runAiGenerationOn`). The **inline** commands — `mockaccino.mockCurrentFileInline` (active editor) / `mockaccino.mockFileInline` (pick a file) — take the separate `runInline` path: the regex backend's `mockInline(content)` produces the rewritten source, which `applyInline` writes back **into the same file** (an undoable `WorkspaceEdit` when the file is open in an editor, else `fs.writeFile`).
- **[src/mockaccino.ts](src/mockaccino.ts)** — Abstract orchestrator base. Owns the backend-independent pipeline (doc metadata, naming, `TemplateContext`, output-path resolution) and the `mock()` / `stub()` template methods that render via template and write. Declares three protected abstract hooks the backend implements: `getMockMethodStrings()`, `getMockImplStrings()`, `getStubImplStrings()`, plus a fourth non-abstract `getCppMockClassStrings()` (default `[]`) backends override for the C++ class path. `mock()` writes a single `_mock.h` (the C mock class and/or the C++ class mocks) whenever there is anything to mock, the companion `_mock.cc` only when there are C functions, and errors only when both are empty. A separate `mockInline(source)` renders only the C++ class mocks (the C path needs a separate `.cc` for the linkage symbols, so it has no inline form) and returns the rewritten `content` + a `changed` flag **without touching disk** (the caller applies it), so the edit can be undoable. Subclasses do their own preprocessing/parsing *after* `super()`, so the hooks only fire from `mock()`/`stub()`/`mockInline()`, never mid-construction.
- **[src/inline_mock_inserter.ts](src/inline_mock_inserter.ts)** — Pure (vscode-free, unit-tested) helper for the inline path. `insertInlineMocks(source, classBlocks, {guardMacro})` injects the rendered C++ mock-class blocks into the source: wrapped in `// >>> MOCKACCINO INLINE MOCKS …` BEGIN/END markers and an `#ifdef <guardMacro>` (default `MOCKACCINO_INLINE_MOCKS`, config `mockaccino.cpp.inlineMockGuardMacro`) that also gates the `#include <gmock/gmock.h>`, so the mocks only compile in the test build. Placement (`findInsertionOffset`): before the file's closing include-guard `#endif`, else before trailing end-of-file comments — found via `blankComments` (a length-preserving comment/string blanker, so a `//` inside a string or a `#endif // GUARD` trailer doesn't fool it). Re-run behaviour: an existing marked block is regenerated in place; otherwise classes already declared elsewhere (manual/unmarked) are dropped so nothing is duplicated.
- **[src/regex_mockaccino.ts](src/regex_mockaccino.ts)** — Concrete regex-parser backend (the behaviour used today, and the only one wired into `extension.ts`). Constructor preprocesses via `Preprocessor` and builds `RegexParser` + `ImplGenerator`; the hooks delegate to them via the shared `FunctionStringifier`. Exposes `c_functions_strings`.
- **[src/clang_mockaccino.ts](src/clang_mockaccino.ts)** — Concrete clang backend. Runs `ClangParser` (feeding source on stdin so includes resolve), applies the same config-driven filters as the regex backend, projects the structured params into types-only / types+names / names-only, and formats via the shared `FunctionStringifier`. Builds clang args from config: `mockaccino.includeDirectories` (`-I`), `mockaccino.clangSystemHeaderPaths` (`-isystem`), `mockaccino.clangExtraArgs` (verbatim), and `mockaccino.clangPath` (binary). Reached via the `extension.ts` "(advanced)" commands (pick "Clang" in the method quick-pick); requires a `clang` on PATH or via `mockaccino.clangPath` (the in-extension downloader is still a TODO).
- **[src/include_paths.ts](src/include_paths.ts)** — Pure (vscode-free, unit-tested) helpers for the clang backend's include dirs: `fromCCppPropertiesFile()` parses `.vscode/c_cpp_properties.json` (union of every configuration's `includePath`; missing/JSONC file → `[]`), and `normalize()` expands `${workspaceFolder}`, drops `${default}`/unresolved-variable entries, strips trailing recursive globs (`/**`, `/*`) to the base dir, and dedupes keeping first occurrence. `extension.ts` reads `C_Cpp.default.includePath` via the config API and combines it with the parsed file; clang resolves a duplicated header from the **first** `-I` dir, and `mockaccino.includeDirectories` are placed first so they win such a clash.
- **[src/clang_parser.ts](src/clang_parser.ts)** — Spawns `clang -Xclang -ast-dump=json -fsyntax-only -x c -` with source on stdin, then `extractTargetFunctions()` walks the JSON AST for top-level `FunctionDecl`s in the main translation unit (clang reports it as `<stdin>`; included-header decls carry a different `loc.file` and are filtered out). Returns structured `{returnType, name, params[{type,name}], is_static, is_extern, is_variadic}`. Pure helpers (`returnTypeOf`, `isMainFile`, `extractTargetFunctions`) are unit-tested without a toolchain.
- **[src/function_stringifier.ts](src/function_stringifier.ts)** — Backend-agnostic source-string templates: `mockMethod` (MOCK_METHOD entry), `mockImpl` (forwards to the mock instance), `stubImpl` (prints info + safe-default return). Takes return type, name and pre-projected argument strings; each backend derives those projections its own way. Shared by `ImplGenerator` (regex) and `ClangMockaccino`.
- **[src/cpp_class_parser.ts](src/cpp_class_parser.ts)** — Heuristic (regex/scope-walker) C++ class extractor for the gmock class path; pure/vscode-free. `extractCppClasses(source)` cleans the text via `Preprocessor` then walks braces as a namespace/class/struct frame stack, returning `{name, qualifiedName, mockClassName, isAbstract, methods[]}` for classes with ≥1 mockable (`virtual`, non-`final`) method. Also exports `mockClassNameFor` (`a::B::C` → `a_B_C_Mock`). Used by the regex/ai backends (and clang reuses `mockClassNameFor`).
- **[src/cpp_class_selection.ts](src/cpp_class_selection.ts)** — Pure `selectMockClasses(classes, {onlyVirtualOrInterface, interfaceNamePatterns})` applying the `mockaccino.cpp.*` interface restriction.
- **[src/cpp_mock_stringifier.ts](src/cpp_mock_stringifier.ts)** — Renders a `CppClass` to a mock class block (the C++ counterpart of `function_stringifier`). `MOCK_METHOD` specs: `override` always, `const` first, `noexcept` last. `stringifyMockClass(cppClass, flatten=true)`: flattened → global-namespace `class app_Outer_Inner_Mock : public app::Outer::Inner`; `flatten=false` (`mockaccino.cpp.flattenNamespaces` off) → wraps the class in `namespace app::… { }` with a base relative to it (`Outer_Inner_Mock : public Outer::Inner`), so the parser tracks `namespaces`/`classPath` separately.
- **[src/cpp_mockgen.ts](src/cpp_mockgen.ts)** — Glue shared by all backends: `buildCppMockStrings(content, config)` (regex extraction + selection + stringify) and `selectCppMockStrings(classes, config)` (selection + stringify, for the clang AST classes). Reads `mockaccino.cpp.*`.
- **[src/preprocessor.ts](src/preprocessor.ts)** — Self-contained C preprocessor used by the **regex** backend only (clang does its own preprocessing). Fluent API (methods return `this`). `preprocess()` evaluates macro expansion and conditionals using `Function("use strict"; return (expr))()`.
- **[src/regex_parser.ts](src/regex_parser.ts)** — `RegexParser.getFunctions()` parses + filters the candidate strings into `FunctionInfo[]`; `getFunctionStrings()` projects args and stringifies. `RegexParserToolbox` has three argument-processing modes: `defaultProcessArguments` (add names to unnamed args), `removeArgumentName_ProcessArguments` (types only, for MOCK_METHOD / stub signatures), `extractArgumentName_ProcessArguments` (names only, for call forwarding inside .cc).
- **[src/interpolator.ts](src/interpolator.ts)** — Wraps a JS template literal evaluation. Templates use `${instance.fieldName}` and `${variableName}` syntax; backslashes in the template are escaped before eval.
- **[templates/](templates/)** — Three template files (`mock_header_template.h`, `mock_src_template.cc`, `stub_src_template.cc`). These are real files read at runtime (not bundled as strings); the path is resolved via `context.asAbsolutePath('templates')`. Template variables come from the `TemplateContext` object (passed to the renderer as `instance`) and local variables passed to `Interpolator`.

### Mock vs Stub output

- **Mock** (`_mock.h` always, `_mock.cc` only when there are C functions): The single header holds the C mock class (a C++ class with `MOCK_METHOD(...)` entries, only when the file has ≥1 mockable C function) and/or the C++ class mocks (below). The header extension (`.h`/`.hpp`) is `mockaccino.mockHeaderExtension` — it drives the output filename, the include guard suffix (`_H`/`_HPP`), and the `#include` in the `.cc`; `Naming` derives all three (`mock_header_name`, `mock_header_guard`). The `_mock.cc` source has the C function wrappers that delegate to a singleton mock instance pointer; its extension (`.cc`/`.cpp`) is `mockaccino.mockSourceExtension`, and it is written only when there are C functions (the C++ class mocks are header-only). The header pulls in the original file via `#ifdef __cplusplus`-guarded `extern "C"` for a pure-C header, or a plain `#include` once C++ classes are involved (the C++/mixed header manages its own linkage).
- **Stub** (`_stub.cc` only): C function wrappers that print info and return a zero-cast value (or `nullptr` for pointers, nothing for `void`).
- **C++ class mock** (part of the same `_mock.h`): generated by the same `mock` command, alongside any C output, for C++ interfaces in the file. Each selected class becomes a flat, global-namespace `class <scope>_<Name>_Mock : public <qualified::Base>` with `MOCK_METHOD(..., (override))` per virtual method. No stub (gmock classes are runtime-mocked). Written only when ≥1 class qualifies; the success path reports the union of function + class mocks, and only errors when *both* are empty.

### C++ class-mock pipeline

Runs from the base `mock()` via the `getCppMockClassStrings()` hook (default `[]`), so it fires alongside the C path for every backend:

```
Active editor text
  → backend hook getCppMockClassStrings()
    → regex/ai: cpp_mockgen.buildCppMockStrings(content, config)
        cpp_class_parser.extractCppClasses  ← brace-depth scope walker (heuristic,
            vscode-free): tracks namespace/class/struct frames, attributes each
            virtual method to its innermost class, builds qualified names; nested
            classes get the most-nested attribution
        cpp_class_selection.selectMockClasses  ← mockaccino.cpp.* filter
        cpp_mock_stringifier.stringifyMockClass  ← one class block
    → clang: clang_parser.parseClasses (a second `-x c++` AST pass) →
        ClangParser.extractCppClasses (walks NamespaceDecl/CXXRecordDecl/CXXMethodDecl)
        → cpp_mockgen.selectCppMockStrings (shared selection + stringifier)
  → Mockaccino.mock() renders the class blocks into the single mock_header_template.h
    (TemplateRenderer.renderMockHeader assembles the C mock class and/or C++ class
    mocks, and the include block, into one header)
    → FileWriter.writeMockHeader → _mock.h
```

Selection (`mockaccino.cpp.*`): only `virtual`, non-`final` methods are mockable (static/templated/operator/ctor/dtor skipped). `cpp.enabled` (default true) gates the whole path. With `cpp.onlyVirtualOrInterfaceClasses` (default true) a class is mocked iff it is abstract (≥1 pure-virtual) **or** its name matches `cpp.interfaceNamePatterns` (case-insensitive, **empty by default** — so only abstract interfaces are mocked unless you add patterns). `cpp.flattenNamespaces` (default true) picks the layout: flat global classes vs namespace-mirroring. The clang C-function parse (`-x c`) can't parse a C++-only file, so `ClangMockaccino.getFunctions()` treats a no-AST throw as "no C functions" and lets the `-x c++` class path proceed.

### Module system quirk

All non-extension source files use `if(typeof module === "object") module.exports = ...` for CommonJS compatibility with test/Node environments, and are imported via extensionless `require("./mockaccino")`. esbuild resolves these to the `.ts` sources when bundling, and plain Node resolves them to the compiled `out/*.js` when testing. (Do **not** reintroduce a `.ts` extension in these requires — it works under esbuild but breaks `require()` of the compiled output, since `out/` only contains `.js`.)

### `ParserConfig` and `FunctionInfo` types

Defined in [src/typings/index.d.ts](src/typings/index.d.ts) as global ambient declarations (no import needed).
