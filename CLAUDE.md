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
- **`npm run test:unit`** — compiles to `out/` then runs mocha (TDD UI) over `out/test/**/*.test.js`, excluding `extension.test.js`. Covers the pure logic modules (`preprocessor`, `regex_parser`, `interpolator`) without downloading/launching VS Code. Use this for the fast refactor loop.
- **`npm run test`** — launches a headless Electron VS Code; required only for tests that import the `vscode` API (currently just `extension.test.ts`).

Unit tests live in `src/test/*.test.ts` and `require()` the **compiled** sibling module (e.g. `require('../preprocessor')` → `out/preprocessor.js`), not the `.ts` source. They use mocha's TDD interface (`suite`/`test`) to match the harness. Note `mockaccino.ts` and `extension.ts` cannot be unit-tested this way: they use `require("./x.ts")` (literal `.ts`) which only resolves under esbuild bundling, plus `vscode`/`fs` deps.

To publish a new `.vsix`: `npx vsce package` (requires `vsce` globally or via npx).

## Architecture

### Processing pipeline (on each command invocation)

```
Active editor text
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
  → Interpolator         (interpolator.ts)
      fills template files using JS template literal eval
  → fs.writeFileSync     → output .h / .cc files
```

### Key source files

- **[src/extension.ts](src/extension.ts)** — VS Code entry point; registers `mockaccino.mockCurrentFile` and `mockaccino.stubCurrentFile` commands; constructs `Mockaccino` and calls `.mock()` / `.stub()`.
- **[src/mockaccino.ts](src/mockaccino.ts)** — Core orchestrator. Constructor runs the full preprocessing pipeline. `mock()` / `stub()` call `RegexParser.getFunctionStrings()` with different stringify callbacks, then write via template.
- **[src/preprocessor.ts](src/preprocessor.ts)** — Self-contained C preprocessor. Fluent API (methods return `this`). `preprocess()` evaluates macro expansion and conditionals using `Function("use strict"; return (expr))()`.
- **[src/regex_parser.ts](src/regex_parser.ts)** — `RegexParser` calls `RegexParserToolbox.parseFunctionDeclaration()` per expression. `RegexParserToolbox` has three argument-processing modes: `defaultProcessArguments` (add names to unnamed args), `removeArgumentName_ProcessArguments` (for mock header MOCK_METHOD), `extractArgumentName_ProcessArguments` (for call forwarding inside .cc).
- **[src/interpolator.ts](src/interpolator.ts)** — Wraps a JS template literal evaluation. Templates use `${instance.fieldName}` and `${variableName}` syntax; backslashes in the template are escaped before eval.
- **[templates/](templates/)** — Three template files (`mock_header_template.h`, `mock_src_template.cc`, `stub_src_template.cc`). These are real files read at runtime (not bundled as strings); the path is resolved via `context.asAbsolutePath('templates')`. Template variables come from `Mockaccino` instance fields and local variables passed to `Interpolator`.

### Mock vs Stub output

- **Mock** (`_mock.h` + `_mock.cc`): Header has a C++ class with `MOCK_METHOD(...)` entries. Source has C function wrappers that delegate to a singleton mock instance pointer.
- **Stub** (`_stub.cc` only): C function wrappers that print info and return a zero-cast value (or `nullptr` for pointers, nothing for `void`).

### Module system quirk

All non-extension source files use `if(typeof module === "object") module.exports = ...` for CommonJS compatibility with test/Node environments, but are imported in `extension.ts` via `require("./mockaccino.ts")`. The esbuild config handles bundling these `.ts` files directly.

### `ParserConfig` and `FunctionInfo` types

Defined in [src/typings/index.d.ts](src/typings/index.d.ts) as global ambient declarations (no import needed).
