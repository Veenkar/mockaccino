<p align="center">
  <img src="https://raw.githubusercontent.com/Veenkar/mockaccino/master/images/mockaccino_icon.png" alt="Mockaccino" width="128" />
</p>

<h1 align="center">Mockaccino</h1>

<p align="center">Generate C++ <a href="https://github.com/google/googletest">GoogleMock</a> mocks and stubs from C source/header files — one command, no boilerplate.</p>

---

Writing unit tests for C code means faking its dependencies, and hand-writing a gmock wrapper for every function in a header is slow, repetitive work. **Mockaccino does it for you:** point it at a `.c`/`.h` file and it generates a ready-to-compile gmock mock class (plus the C-linkage wrappers that route the real C calls into it), or a lightweight stub.

It's built for the people who feel that pain most: **testing embedded, firmware, or legacy C with a C++/GoogleTest harness**, where the dependency you want to fake is a header full of plain C functions.

## Why Mockaccino

There are two ways to turn C into mocks, and Mockaccino ships **both**, switchable per command:

| | **Regex backend** (default) | **Clang backend** |
|---|---|---|
| Command | *“… (regex)”* | *“… (clang)”* |
| Needs a compilable file + resolvable includes | **No** | Yes |
| Unknown/vendor type modifiers (e.g. AUTOSAR `FUNC(...)`, `P2VAR(...)`) | Handled via configurable macro definitions | Resolved by the compiler |
| External tools | **None** — pure TypeScript | A `clang` binary |
| Best for | Vendor/AUTOSAR headers, legacy code, half-finished or non-compiling snippets | Clean, compilable headers where you want exact type resolution |

The **regex backend** is the original superpower: it parses with regular expressions, not a real compiler, so it generates a usable mock **without resolving includes, building the project, or understanding your custom type modifiers**. That's exactly the situation embedded/legacy C testing puts you in — and where compiler-based tools tend to choke.

The **clang backend** covers the other half: when your header *is* clean and compilable, it asks a real `clang` for the truth, so includes, typedefs, and struct-by-value parameters resolve precisely.

## Quick start

1. Install **Mockaccino** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino).
2. Open a C source or header file.
3. Open the Command Palette (`Ctrl/Cmd+Shift+P`) and run one of:
   - **Mockaccino: mock current file** — regex backend (default)
   - **Mockaccino: stub current file** — regex backend (default)
   - **Mockaccino: mock current file (clang)** — clang backend
   - **Mockaccino: stub current file (clang)** — clang backend
4. The generated files appear next to your input (or in `mockaccino.outputPath`), with `_mock` / `_stub` appended.

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

## How parsing works

- **Regex backend** — the file's preprocessor directives (and any you add in settings) are evaluated, comments and function bodies are stripped, and the remaining function declarations are matched with regular expressions. No include is read and no AST is built, so it needs no knowledge of your type names and tolerates unusual C dialects. The trade-off: very unusual declarators may need a helper macro definition (or the clang backend).
- **Clang backend** — the source is handed to `clang -ast-dump=json` (fed on stdin, so unsaved edits and `#include "sibling.h"` both work). Mockaccino reads the resulting AST and mocks only the functions **declared in the opened file** — includes are parsed for type resolution but not mocked.

clang's diagnostics (and any generation errors) are logged to a **“Mockaccino” tab in the Terminal panel** *and* to the matching **Output channel** (View → Output → *Mockaccino*). If clang reports errors, you'll get a warning that the generated mock may be incomplete and the log is brought into view with the details.

## Requirements

- **Regex backend:** none.
- **Clang backend:** a `clang` executable on `PATH` or set via `mockaccino.clangPath`.

## Scope & limitations

- Mockaccino mocks **free C functions** (C-linkage symbols) and, in the same run, **C++ interface classes** (a `_mock.hpp` of gmock mock classes). The C++ class path covers namespaces, nested classes, and `const`/`noexcept`/`override` methods; **templated classes, operator overloads, and ref-qualified methods are skipped** (MVP).
- The regex backend is heuristic by design: most signatures are handled, but exotic declarators (e.g. function-pointer parameters) may need a configured macro or the clang backend. The clang backend parses C++ classes from a real AST for exact resolution.
- The clang backend needs the file — and the includes its signatures depend on — to parse.

## Links

- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino
- **GitHub:** https://github.com/Veenkar/mockaccino
- **Contact:** veenkar@gmail.com

## License

Licensed under the GNU GPL v3.
