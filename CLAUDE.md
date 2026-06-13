# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Mockaccino is a VS Code extension that generates C++ gmock mock and stub files from C source/header files. It uses regex-based parsing (not an AST/compiler) so it works without resolving includes or understanding custom type modifiers.

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

- **Fixtures** live in `src/test/fixtures/<case>/` — one folder per input file. The single `.c`/`.h` input sits at the case-folder root; its golden outputs live in `<case>/expected/` as `<name>_mock.h`, `<name>_mock.cc`, `<name>_stub.cc`. The mock command runs when a `_mock.*` golden exists; the stub command runs when `_stub.cc` exists.
- **`.c` vs `.h` are separate cases.** Either can be mocked/stubbed (definitions vs declarations), and the output differs (most visibly the `INPUT:` line, plus edge-case parsing), so each input file gets its own case folder and goldens (e.g. `main_c` for `main.c`, `main_h` for `main.h`).
- **Config** is pinned to the package.json defaults (the goldens were generated with defaults), pulled at runtime from `contributes.configuration.properties` and written via `ConfigurationTarget.Global`; only `outputPath` is overridden to a temp dir so generated files never overwrite the committed goldens. Config is restored in teardown.
- **Normalization:** the three volatile values — the `TIME:` line, the `VERSION:` line, and the copyright **year** — are rewritten to placeholders on both sides before `assert.strictEqual`, plus CRLF→LF. If a comparison fails on anything else, that's a real generator change — regenerate the golden (don't widen normalization to hide it).

### Integration suite (`integration/`, mandatory — `npm run test:integration`)

A **mandatory** suite that proves generated mocks *and stubs* actually *compile and run*. It is its own script (not folded into `npm run test`/`test:unit`), and it never skips — it must actually run and pass. `node integration/run.js` (= `npm run test:integration`): compiles the extension, runs `RegexMockaccino` on `integration/src/display.h` + `rng.h` to emit gmock mocks **and stubs** into `integration/generated/`, configures+builds a CMake project with **clang** (GoogleTest via `FetchContent`, so the first run needs network), runs the gmock `unit_tests` and the `stub_tests` via `ctest`, then runs the real `game_of_life` binary. Anything that stops it — a missing tool (clang/cmake/ninja/network) or a genuine build/test failure — exits non-zero.

The example program is a console Conway's Game of Life: `board`/`engine` are compiled for real (and `board` is unit-tested directly), while `display` and `rng` are the **mocked/stubbed** dependencies (their real `.c` is not linked into the tests — the generated `*_mock.cc`/`*_stub.cc` provide the C-linkage symbols). `display.h`/`rng.h` carry deliberately varied signatures to exercise Mockaccino's parsing paths. Mocks (`unit_tests`) verify interactions via `EXPECT_CALL`; stubs (`stub_tests`, a separate executable since a stub and mock can't define the same symbol in one binary) just verify the stub links and returns the safe defaults. `integration/build/` and `integration/generated/` are gitignored. See [integration/README.md](integration/README.md).

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

- **[src/extension.ts](src/extension.ts)** — VS Code entry point; registers `mockaccino.mockCurrentFile` and `mockaccino.stubCurrentFile` commands; constructs `RegexMockaccino` and calls `.mock()` / `.stub()`.
- **[src/mockaccino.ts](src/mockaccino.ts)** — Abstract orchestrator base. Owns the backend-independent pipeline (doc metadata, naming, `TemplateContext`, output-path resolution) and the `mock()` / `stub()` template methods that render via template and write. Declares three protected abstract hooks the backend implements: `getMockMethodStrings()`, `getMockImplStrings()`, `getStubImplStrings()`. Subclasses do their own preprocessing/parsing *after* `super()`, so the hooks only fire from `mock()`/`stub()`, never mid-construction.
- **[src/regex_mockaccino.ts](src/regex_mockaccino.ts)** — Concrete regex-parser backend (the behaviour used today). Constructor preprocesses via `Preprocessor` and builds `RegexParser` + `ImplGenerator`; the hooks delegate to them. Exposes `c_functions_strings`.
- **[src/clang_mockaccino.ts](src/clang_mockaccino.ts)** — Concrete clang backend **scaffold** (not wired into `extension.ts`). Gathers include directories from the `mockaccino.includeDirectories` setting; the generation hooks throw `not yet implemented`. The plan is for clang to do its own include-resolving preprocessing/parsing and feed the same base render/write path.
- **[src/preprocessor.ts](src/preprocessor.ts)** — Self-contained C preprocessor. Fluent API (methods return `this`). `preprocess()` evaluates macro expansion and conditionals using `Function("use strict"; return (expr))()`.
- **[src/regex_parser.ts](src/regex_parser.ts)** — `RegexParser` calls `RegexParserToolbox.parseFunctionDeclaration()` per expression. `RegexParserToolbox` has three argument-processing modes: `defaultProcessArguments` (add names to unnamed args), `removeArgumentName_ProcessArguments` (for mock header MOCK_METHOD), `extractArgumentName_ProcessArguments` (for call forwarding inside .cc).
- **[src/interpolator.ts](src/interpolator.ts)** — Wraps a JS template literal evaluation. Templates use `${instance.fieldName}` and `${variableName}` syntax; backslashes in the template are escaped before eval.
- **[templates/](templates/)** — Three template files (`mock_header_template.h`, `mock_src_template.cc`, `stub_src_template.cc`). These are real files read at runtime (not bundled as strings); the path is resolved via `context.asAbsolutePath('templates')`. Template variables come from the `TemplateContext` object (passed to the renderer as `instance`) and local variables passed to `Interpolator`.

### Mock vs Stub output

- **Mock** (`_mock.h` + `_mock.cc`): Header has a C++ class with `MOCK_METHOD(...)` entries. Source has C function wrappers that delegate to a singleton mock instance pointer.
- **Stub** (`_stub.cc` only): C function wrappers that print info and return a zero-cast value (or `nullptr` for pointers, nothing for `void`).

### Module system quirk

All non-extension source files use `if(typeof module === "object") module.exports = ...` for CommonJS compatibility with test/Node environments, and are imported via extensionless `require("./mockaccino")`. esbuild resolves these to the `.ts` sources when bundling, and plain Node resolves them to the compiled `out/*.js` when testing. (Do **not** reintroduce a `.ts` extension in these requires — it works under esbuild but breaks `require()` of the compiled output, since `out/` only contains `.js`.)

### `ParserConfig` and `FunctionInfo` types

Defined in [src/typings/index.d.ts](src/typings/index.d.ts) as global ambient declarations (no import needed).
