<p align="center">
  <img src="https://raw.githubusercontent.com/Veenkar/mockaccino/master/images/mockaccino_icon.png" alt="Mockaccino" width="128" />
</p>

<h1 align="center">Mockaccino</h1>

<p align="center">Generate C++ <a href="https://github.com/google/googletest">GoogleMock</a> mocks and stubs from C source/header files — one command, no boilerplate.</p>

---

Writing unit tests for C code means faking its dependencies, and hand-writing a gmock wrapper for every function in a header is slow, repetitive work. **Mockaccino does it for you:** point it at a `.c`/`.h` file and it generates a ready-to-compile gmock mock class (plus the C-linkage wrappers that route the real C calls into it), or a lightweight stub.

It's built for the people who feel that pain most: **testing embedded, firmware, or legacy C with a C++/GoogleTest harness**, where the dependency you want to fake is a header full of plain C functions.

## Why Mockaccino

There are three ways to turn C into mocks, and Mockaccino ships **all of them**, switchable per command:

| | **Regex backend** (default) | **Clang backend** | **AI parser backend** |
|---|---|---|---|
| Command | *“mock/stub current file”* | *“… (clang)”* | *“… (AI parser)”* |
| Needs a compilable file + resolvable includes | **No** | Yes | **No** |
| Unknown/vendor type modifiers (e.g. AUTOSAR `FUNC(...)`, `P2VAR(...)`) | Handled via configurable macro definitions | Resolved by the compiler | Understood by the model |
| External tools | **None** — pure TypeScript | A `clang` binary | A language model (Copilot, MCP sampling, or the `claude` CLI) |
| Best for | Vendor/AUTOSAR headers, legacy code, half-finished or non-compiling snippets | Clean, compilable headers where you want exact type resolution | Messy or unusual signatures regex can't parse, when a model is available |

The **regex backend** is the original superpower: it parses with regular expressions, not a real compiler, so it generates a usable mock **without resolving includes, building the project, or understanding your custom type modifiers**. That's exactly the situation embedded/legacy C testing puts you in — and where compiler-based tools tend to choke.

The **clang backend** covers the other half: when your header *is* clean and compilable, it asks a real `clang` for the truth, so includes, typedefs, and struct-by-value parameters resolve precisely.

The **AI parser backend** asks a language model to do the extraction wherever the regex backend would use a regular expression — so it shares the regex backend's tolerance for non-compiling input but can read signatures regex heuristics miss. The model comes from whatever's available (Copilot via `vscode.lm`, MCP sampling, or the local `claude` CLI). Mockaccino also runs as an **[MCP server](#mcp-server)**, so AI clients (Copilot agent mode, Claude Code) can drive the same generation.

## Quick start

1. Install **Mockaccino** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino).
2. Open a C source or header file.
3. Open the Command Palette (`Ctrl/Cmd+Shift+P`) and run one of:
   - **Mockaccino: mock current file** — regex backend (default), active editor
   - **Mockaccino: stub current file** — regex backend (default), active editor
   - **Mockaccino: mock a file (pick location)** — regex backend, pick the file via a dialog
   - **Mockaccino: stub a file (pick location)** — regex backend, pick the file via a dialog
   - **Mockaccino: mock current file (advanced — pick regex/clang/AI)** — choose the parser backend
   - **Mockaccino: stub current file (advanced — pick regex/clang/AI)** — choose the parser backend
   - **Mockaccino: mock a file (pick location, advanced — pick regex/clang/AI)** — pick the file *and* the backend
   - **Mockaccino: stub a file (pick location, advanced — pick regex/clang/AI)** — pick the file *and* the backend
4. The generated files appear next to your input (or in `mockaccino.outputPath`), with `_mock` / `_stub` appended.

   The **clang** and **AI** backends are no longer separate commands — run an **(advanced)** command and pick the backend (regex / clang / AI) from the quick-pick.

<!-- Maintainer note: a short header-in → mock-out demo GIF would shine here. -->

## What it generates

### Mock (`_mock.h` + `_mock.cc`)

Given a header:

```c
/* display.h */
typedef struct { int x, y; } Viewport;

void        display_init(void);
int         display_width(void);
const char *display_backend_name(void);
void        display_draw_cell(int x, int y, int alive);
void        display_set_viewport(Viewport vp);
```

Mockaccino produces a mock class…

```cpp
/* display_mock.h */
class Display_Mock {
public:
    Display_Mock();
    virtual ~Display_Mock();
    MOCK_METHOD(void, display_init, ());
    MOCK_METHOD(int, display_width, ());
    MOCK_METHOD(const char *, display_backend_name, ());
    MOCK_METHOD(void, display_draw_cell, (int, int, int));
    MOCK_METHOD(void, display_set_viewport, (Viewport));
};
```

…and C-linkage wrappers that forward every call to the active mock instance:

```cpp
/* display_mock.cc */
void display_draw_cell(int x, int y, int alive)
{
    DISPLAY_MOCK_ASSERT_INSTANCE_EXISTS();
    return display_mock_->display_draw_cell(x, y, alive);
}
```

So your test links the generated `.cc` instead of the real `display.c`, and drives it with gmock:

```cpp
TEST(EngineTest, RendersEveryCell) {
    Display_Mock display;   // construction registers it as the active mock
    EXPECT_CALL(display, display_draw_cell(_, _, _)).Times(WIDTH * HEIGHT);

    engine_render();        // the C code under test calls the C functions
}                           // destruction clears the active mock
```

### Stub (`_stub.cc`)

A lighter alternative when you just need the symbols to link and return safe defaults — each stub prints a trace line and returns `0` / `nullptr` / nothing:

```cpp
const char *display_backend_name()
{
    DISPLAY_STUB_PRINT_INFO();
    return nullptr;
}
int display_width()
{
    DISPLAY_STUB_PRINT_INFO();
    return static_cast<int>(0);
}
```

(A mock and a stub can't define the same symbol in one binary — use one or the other per test executable.)

### C++ class mocks (`_mock.hpp`)

The same **mock** command also generates gmock **mock classes** for C++ interfaces in the file — there's no separate command and no file-type switch: it mocks free C functions the usual way *and*, when the file declares C++ classes, writes a `_mock.hpp` next to them. gmock can only override `virtual` methods, so Mockaccino targets interface-like classes. Given:

```cpp
/* sink.hpp */
namespace metrics {
class ISink {
public:
    virtual ~ISink() = default;
    virtual void publish(int value) = 0;
    virtual int  total() const = 0;
};
}
```

it produces (`sink_mock.hpp`):

```cpp
class metrics_ISink_Mock : public metrics::ISink {
public:
    MOCK_METHOD(void, publish, (int), (override));
    MOCK_METHOD(int, total, (), (const, override));
};
```

Namespaces and nested classes are supported — the mock is a flat, global-namespace class whose name encodes the scope (`app::Outer::Inner` → `app_Outer_Inner_Mock`) deriving from the fully-qualified base. By default only **abstract** interfaces (a class with a pure-virtual method) are mocked; set `cpp.interfaceNamePatterns` to also select classes by name, or turn off `cpp.onlyVirtualOrInterfaceClasses` to mock any class with an overridable virtual method.

## Configuration

All settings live under `mockaccino.*` in VS Code settings.

**General**

| Setting | Description |
|---|---|
| `outputPath` | Where to write generated files. Supports `${workspaceFolder}`. Empty → next to the input file. |
| `ignoredFunctionNames` | Comma-separated function names to skip (e.g. `main`). |
| `skipStaticFunctions` | Skip `static` functions. |
| `skipExternFunctions` | Skip `extern` functions. |
| `skipFunctionsWithImplicitReturnType` | Skip functions with an implicit (`int`) return — these are often function-like macros. |
| `disableDoubleMocking` | Don't mock files that already contain `_mock` / `_stub` in their name. |
| `copyright` | Copyright notice inserted into generated files (`$YEAR` is expanded). |
| `mockSourceExtension` | Extension for the generated C-wrapper source files (`_mock` / `_stub`): `cc` (default) or `cpp`. The C mock header stays `.h`, the C++ class mock stays `.hpp`. |

**C++ class mocks**

| Setting | Description |
|---|---|
| `cpp.enabled` | Also generate a `_mock.hpp` of gmock mock classes for C++ interfaces in the file (default on). |
| `cpp.onlyVirtualOrInterfaceClasses` | Only mock interface-like classes — abstract, or name-matched via `cpp.interfaceNamePatterns` (default on). Off → mock any class with an overridable virtual method. |
| `cpp.interfaceNamePatterns` | Case-insensitive name substrings that also select a class for mocking (e.g. `interface`). Empty by default — only abstract classes are mocked. |
| `cpp.flattenNamespaces` | Layout of namespaced mock classes. On (default): one flat global class encoding the scope (`class app_Outer_Inner_Mock : public app::Outer::Inner`). Off: mirror the source namespaces (`namespace app { class Outer_Inner_Mock : public Outer::Inner {…}; }`). |

**Regex backend**

| Setting | Description |
|---|---|
| `additionalPreprocessorDirectives` | Macro definitions prepended before parsing — teach Mockaccino your vendor modifiers (`FUNC`, `P2VAR`, …) so they resolve to plain types. |
| `treatLonelyPreprocIfAsActive` | Treat a lone `#if … #endif` as active, so conditionally-compiled functions still get mocked. |

**Clang backend**

| Setting | Description |
|---|---|
| `clangPath` | Path to the `clang` executable. Empty → use `clang` on `PATH`. |
| `includeDirectories` | `-I` project include dirs. Supports `${workspaceFolder}`. |
| `clangSystemHeaderPaths` | `-isystem` system header dirs (a custom libc/SDK). Leave empty to use clang's own headers. |
| `clangExtraArgs` | Extra clang arguments passed verbatim (`-nostdinc`, `-resource-dir=…`, `-target=…`, `-std=c11`). |

> The clang backend also reads include paths from the C/C++ extension's configuration (`C_Cpp.default.includePath` and `.vscode/c_cpp_properties.json`). When a header exists in more than one include directory, clang uses the first match in `-I` order — Mockaccino lists your `includeDirectories` first, so they win.

**AI parser backend**

| Setting | Description |
|---|---|
| `ai.inputMode` | What the model sees: `fullFile` (the whole source, model resolves context), `declarations` (default — only the candidate declaration strings the regex preprocessor extracts; cheaper), or `declarationsWithContext` (those declarations to extract, plus the whole file as read-only type context). |
| `ai.preferredModelSource` | Preferred model: `sampling` (the calling MCP client's model — Copilot supports it, Claude Code doesn't), `vscodeLm` (the editor's model, e.g. Copilot), or `claudeCli` (shells out to the `claude` CLI). Falls back to the other available sources on failure; the source actually used is reported. |
| `ai.enableClaudeCli` | Allow the `claudeCli` model source (off by default). |
| `ai.claudePath` | Path to the `claude` CLI for the `claudeCli` source. Empty → use `claude` on `PATH`. |
| `ai.claudeArgs` | Extra arguments passed to the `claude` CLI (e.g. `--model`). The prompt is always sent on stdin with `-p`. |

**MCP server**

| Setting | Description |
|---|---|
| `mcp.enabled` | Run the Mockaccino MCP server so AI clients can generate mocks/stubs (default on). |
| `mcp.port` | Localhost TCP port for the server. `0` picks a free port each start; set a fixed port if you wire it into Claude Code via `.mcp.json` so the URL stays stable across restarts. |
| `mcp.enableClangBackend` | Allow MCP clients to use the clang backend (off by default; regex is always available over MCP). |
| `mcp.enableAiBackend` | Allow MCP clients to use the AI backend (off by default; regex is always available over MCP). |

## MCP server

Mockaccino runs an in-process **MCP server** (in the extension host) that exposes the same mock/stub generation to AI clients, with two tools mirroring the palette (`generate_mock` / `generate_stub`). Each tool takes a `backend` (`regex` / `clang` / `ai`), an optional file `path` (defaults to the active editor), and an optional `outputDir`. After generating, the result reports the written file paths, the effective and configured output directories, and the comment-stripped key content of each file, so the model can act on it without a second round-trip. **Regex is always available; `clang` and `ai` are gated** by `mcp.enableClangBackend` / `mcp.enableAiBackend`.

- **Copilot (agent mode)** discovers the contributed server automatically — no setup.
- **Claude Code** does not auto-discover VS Code-contributed servers. Run **Mockaccino: add MCP server to Claude Code (.mcp.json)** to write the server entry (pointing at the in-extension HTTP endpoint) into your project's `.mcp.json`. Pin `mcp.port` so the URL stays stable. The server is only reachable while VS Code is open.

## How parsing works

- **Regex backend** — the file's preprocessor directives (and any you add in settings) are evaluated, comments and function bodies are stripped, and the remaining function declarations are matched with regular expressions. No include is read and no AST is built, so it needs no knowledge of your type names and tolerates unusual C dialects. The trade-off: very unusual declarators may need a helper macro definition (or the clang backend).
- **Clang backend** — the source is handed to `clang -ast-dump=json` (fed on stdin, so unsaved edits and `#include "sibling.h"` both work). Mockaccino reads the resulting AST and mocks only the functions **declared in the opened file** — includes are parsed for type resolution but not mocked.
- **AI parser backend** — wherever the regex backend would match a declaration with a regular expression, this asks a language model to return the structured function list instead (the same shape the other backends produce), then renders through the identical template path. It shares the regex backend's tolerance for non-compiling input; `ai.inputMode` controls whether the model sees the whole file or just the extracted candidate declarations. The C++ class path uses the same heuristic extractor as the regex backend.

clang's diagnostics (and any generation errors) are logged to a **“Mockaccino” tab in the Terminal panel** *and* to the matching **Output channel** (View → Output → *Mockaccino*). If clang reports errors, you'll get a warning that the generated mock may be incomplete and the log is brought into view with the details.

## Requirements

- **Regex backend:** none.
- **Clang backend:** a `clang` executable on `PATH` or set via `mockaccino.clangPath`.
- **AI parser backend:** a reachable language model — Copilot (or another `vscode.lm` provider), an MCP client that supports sampling, or the `claude` CLI (enable `mockaccino.ai.enableClaudeCli`).

## Scope & limitations

- Mockaccino mocks **free C functions** (C-linkage symbols) and, in the same run, **C++ interface classes** (a `_mock.hpp` of gmock mock classes). The C++ class path covers namespaces, nested classes, and `const`/`noexcept`/`override` methods; **templated classes, operator overloads, and ref-qualified methods are skipped** (MVP).
- The regex backend is heuristic by design: most signatures are handled, but exotic declarators (e.g. function-pointer parameters) may need a configured macro, the AI parser, or the clang backend. The clang backend parses C++ classes from a real AST for exact resolution.
- The clang backend needs the file — and the includes its signatures depend on — to parse.
- The AI parser backend needs a reachable model and is non-deterministic; its output quality depends on the model. The C++ class path reuses the regex heuristic extractor.

## Links

- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino
- **GitHub:** https://github.com/Veenkar/mockaccino
- **Contact:** veenkar@gmail.com

## License

Licensed under the GNU GPL v3.
