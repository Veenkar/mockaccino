# Mockaccino MCP server + AI parser — implementation plan

Status: **proposal / awaiting approval.** No code written yet. This document is the
plan referenced in the chat; edit it directly to steer the design.

## Goal (from the request)

1. **AI parser backend** — a third backend alongside `regex` and `clang`. It works
   like the regex backend, but wherever the regex backend uses regex to extract
   function declarations, the AI backend asks an LLM ("the client's model") to do
   it instead. Output is the same structured function list the other backends
   produce, so the existing template/render/write path is reused unchanged.
2. **MCP server, contributed by this extension** (runs in the extension host — not
   a standalone process), exposing mock/stub generation to AI clients:
   - the same options as the command palette: **mock**/**stub** × **regex**/**clang**/**ai**;
   - **regex is always available** over MCP (mock + stub);
   - **clang** over MCP is gated by a settings checkbox;
   - **ai** over MCP is gated by a settings checkbox;
   - after generating, the tool result reports back to the AI: the **paths** of the
     files written, plus the **most important content of those files (comments
     stripped)** so the model can read them without a separate round-trip.

## The load-bearing decision: where the AI parser's model comes from

"Use the client's model" has two mechanisms, and the AI parser must support both
clients (Claude Code extension **and** native VS Code Copilot):

| Mechanism | What it is | Works with | Risk |
|---|---|---|---|
| **MCP sampling** (`createMessage`) | The MCP server asks the *calling* client to run a completion | Any MCP client that implements `sampling` — ideally both Claude Code and Copilot agent mode | **Support is client-dependent; must be verified (Phase 0).** |
| **`vscode.lm`** | The extension borrows a model registered in VS Code (in practice Copilot's) | The command-palette backend, and MCP calls when sampling is unavailable but Copilot is installed | Only present if Copilot (or another LM provider) is installed; it is *not* Claude Code's model |

**Design:** the AI backend takes an injected `complete(prompt) → text` function so it
is agnostic to the source. Two providers implement it:

- `SamplingCompletion` — uses the MCP server's `createMessage` (the caller's model).
  Used by the **MCP tool** path.
- `VsCodeLmCompletion` — uses `vscode.lm.selectChatModels()` + `sendRequest()`.
  Used by the **command-palette** path, and as a **fallback** for the MCP path when
  the client doesn't offer sampling.

**Configurable preference + fallback (decided).** A setting picks the preferred
source; on failure (capability missing, no model, or an error) it transparently
tries the other, and the **method actually used is reported back** (in the MCP tool
result and the "Mockaccino" log).

Model-source providers (each a `complete(prompt) → Promise<string>` implementation):

- **`sampling`** — MCP sampling (`requestSampling`); the calling MCP client's model.
  Works with Copilot (supports sampling); **not** Claude Code (no sampling).
- **`vscodeLm`** — `vscode.lm` (Copilot's model). Available in-editor when an LM
  provider is installed.
- **`claudeCli`** — spawn the **`claude` CLI** in print mode (`claude -p "<prompt>"`,
  response on stdout). Setting `mockaccino.ai.claudePath` (else `claude` on PATH),
  parallel to `clangPath`. **Independent of MCP sampling and Copilot** — gives
  *Claude's* model directly, so it's the answer when sampling is unavailable (e.g.
  invoked from Claude Code) and resolves the "not Claude's model via Claude Code"
  limitation. Async spawn (like ClangParser).

Settings:

- `mockaccino.ai.preferredModelSource`: `"sampling" | "vscodeLm" | "claudeCli"`
  (default `"sampling"`).
- `mockaccino.ai.claudePath`: path to the `claude` CLI (empty → PATH).

Resolution: try the preferred source → fall back through the others that are
available → clear error if none work. The **method actually used is reported back**
(MCP result `modelSource` + the "Mockaccino" log). Command-palette AI backend has no
MCP client, so it tries `claudeCli`/`vscodeLm` (not `sampling`).

This keeps one `AiMockaccino` implementation; only the `complete` provider differs.

**Future-proofing (user note): configurable AI provider.** The AI backend is built
around an injected `complete(prompt) → Promise<string>` function, so the model source
is fully pluggable. Planned later: a `mockaccino.ai.provider` setting selecting among
`sampling` / `vscodeLm` / external APIs (**Ollama / Claude / OpenAI**), each a
`complete` implementation (with their own endpoint/key/model settings). Phase 1 keeps
`AiParser`/`AiMockaccino` provider-agnostic so adding providers is additive — no
backend change.

## Reaching both clients with the server

- **Copilot agent mode**: the extension registers the server via VS Code's MCP
  server-definition provider API (`contributes.mcpServerDefinitionProviders` +
  `vscode.lm.registerMcpServerDefinitionProvider`). Copilot discovers it
  automatically. To let the in-process server use `vscode.lm`, host it as an
  **HTTP** server inside the extension and advertise it with an HTTP server
  definition (a spawned stdio subprocess could not reach `vscode.lm`).
- **Claude Code**: does **not** auto-discover VS Code-contributed servers. We point
  Claude Code's own MCP config at the same in-extension HTTP endpoint (document the
  snippet; optionally a "Mockaccino: add MCP server to Claude Code config" command
  that writes it).

## Phase 0 — de-risk before building (verification only)

These are the assumptions the whole design rests on. Verify first; if one fails, we
adjust the plan, not the code.

1. **MCP sampling support** — confirm whether the Claude Code extension and Copilot
   agent mode (as MCP clients) implement `sampling/createMessage`. Sources: VS Code
   MCP docs, MCP spec, Claude Code MCP docs. If neither supports sampling, the AI
   parser over MCP falls back to `vscode.lm` only (Copilot-dependent) — surface that
   limitation to the user.
2. **Extension-as-MCP-server API** — confirm the current VS Code API for an
   extension to contribute an MCP server (provider API + manifest contribution),
   and whether an in-process HTTP server is the supported way to bridge to
   `vscode.lm`.
3. **`vscode.lm` availability** — confirm `selectChatModels`/`sendRequest` shape and
   that a model is reachable when Copilot is installed; decide behavior when no LM
   is available (error message pointing the user to install Copilot or use a client
   that supports sampling).
4. **`@modelcontextprotocol/sdk`** — pin the TypeScript SDK version and confirm
   `McpServer` / tool registration / HTTP (or stdio) transport / `createMessage`
   bindings.

Deliverable of Phase 0: a short findings note appended here, and a final go/no-go on
sampling vs `vscode.lm`-only.

### Phase 0 findings (complete)

- **VS Code MCP provider API — confirmed.** Extensions register a server via
  `vscode.lm.registerMcpServerDefinitionProvider()` + the
  `contributes.mcpServerDefinitionProviders` manifest point (needs `id` + `label`).
  Two definition types: `vscode.McpStdioServerDefinition` (local subprocess) and
  `vscode.McpHttpServerDefinition` (HTTP/SSE).
- **VS Code/Copilot supports MCP sampling — confirmed.** "VS Code provides access to
  sampling for MCP servers … make language model requests using the user's
  configured models and subscriptions." Users authorize on first use;
  `modelPreferences` hints honored.
- **Claude Code does NOT support MCP sampling — confirmed.** Its MCP docs mention
  **elicitation** (structured user input) but never **sampling**; a server cannot
  request an LLM completion from Claude Code's model. Claude Code adds servers with
  `claude mcp add --transport http|sse|stdio <name> <url>` (HTTP preferred; SSE
  deprecated; `.mcp.json` `{ "type": "http", "url": ... }`).
- **Consequences (decisive):**
  - The server **must be in-process HTTP** in the extension host, so the AI backend
    can fall back to `vscode.lm` when the caller (Claude Code) can't do sampling. A
    stdio subprocess could not reach `vscode.lm`.
  - **Model source by caller:** from **Copilot** → sampling *or* `vscode.lm` (per the
    preferred-source setting). From **Claude Code** → `vscode.lm` only (no sampling),
    i.e. it borrows Copilot's model; if no `vscode.lm` model is available the AI
    backend returns a clear error. The result always reports `modelSource`.
  - **Honest limitation to document:** the AI backend invoked *via Claude Code* uses
    the editor's `vscode.lm` model (Copilot), not Claude Code's own model, because
    Claude Code won't fulfill sampling. Requires Copilot (or another LM provider)
    installed.
- **MCP TypeScript SDK — verify exact package at Phase 1 via `npm`.** Current `main`
  docs show a split (`@modelcontextprotocol/server` + `@modelcontextprotocol/node`),
  `registerTool(name, { description, inputSchema /* zod */ }, handler)`, transports
  `StdioServerTransport` (`@modelcontextprotocol/server/stdio`) /
  `NodeStreamableHTTPServerTransport` (`@modelcontextprotocol/node`), and sampling via
  `ctx.mcpReq.requestSampling({ messages, maxTokens })` (a `ServerContext` 2nd handler
  arg). **But the widely-published package is historically `@modelcontextprotocol/sdk`
  with `server.server.createMessage(...)`** — the split may be an unreleased rewrite.
  Resolve by `npm view` / installing before writing server code; adapt to whichever
  is actually published.

### Transport decision (final)

**In-process HTTP server** (`McpHttpServerDefinition`), hosted in the extension host.
Rationale: satisfies "extension-hosted"; lets the AI backend use `vscode.lm` as the
fallback that Claude Code's lack of sampling makes mandatory; gives a stable
localhost URL to register with Copilot and auto-write into Claude Code's `.mcp.json`.

## Testing requirements (cross-cutting — applies to every phase)

Per project convention and explicit user guidance: **every new feature ships with
tests.** Concretely:

- **Unit tests (`test:unit`, no toolchain/model)** for every new pure module:
  `ai_parser` (JSON→functions mapping, via a **fake `complete`** returning canned
  JSON — no live model), the model-source selection + fallback logic, the MCP tool
  input handling and settings-gating, the report-back digest (comment stripping).
- **Integration tests (`test:integration`)** where applicable: extend the mandatory
  suite to compile an **AI-backend-generated** mock/stub using a **fixed/stubbed**
  function list (deterministic, no live model) so the AI path's *output* is proven
  to compile and run like the regex/clang backends.
- **Anything verified manually becomes a test.** If a behavior is checked by hand
  during development (a spike, a one-off run), codify it as a unit or integration
  test before the phase is considered done — don't leave it as manual-only.
- Keep model/network calls **out of the default test paths**: tests inject fakes;
  real-model behavior is exercised only in manual/opt-in checks, never in CI-style
  runs.

## Phase 1 — `AiMockaccino` backend (no MCP yet)

- New `src/ai_parser.ts`: given source text + a `complete(prompt) → Promise<string>`
  function, prompt the model to return a JSON array of
  `{ returnType, name, params: [{type, name}], is_static, is_extern, is_variadic }`
  for functions **declared in this file only** — the same shape `ClangParser`
  returns. Use structured-output / JSON instructions; parse + validate defensively.
- New `src/ai_mockaccino.ts`: `AiMockaccino extends Mockaccino`. Mirrors
  `ClangMockaccino` (same filters: skip static/extern, ignored names, dedup; same
  `projectArgs` + `FunctionStringifier`), but the function list comes from
  `AiParser` instead of `ClangParser`. Async: the model call is async, so generation
  needs an async path (see "Async note" below).
- `src/vscode_lm_completion.ts`: wraps `vscode.lm` into a `complete` function (lives
  near `extension.ts` since it needs the vscode API; keep parser modules vscode-free).
- Wire a command **"Mockaccino: mock/stub current file (AI)"** using
  `VsCodeLmCompletion`.
- Tests: `ai_parser` JSON→functions mapping is pure → unit-testable with a fake
  `complete` returning canned JSON (no model, no toolchain). Reuse the integration
  suite shape later for an end-to-end compile check using a stubbed/fixed function
  list.

**Async note.** The current `mock()`/`stub()` are synchronous. The AI (and sampling)
calls are async. Options: (a) add `async mockAsync()/stubAsync()` on the base used by
async backends while keeping sync for regex/clang; or (b) make the hooks async and
adapt the two existing backends. Leaning (a) to avoid churn in the proven backends —
to be finalized in Phase 1.

## Phase 2 — settings gating

New `mockaccino.*` settings (names tentative):

- `mockaccino.mcp.enabled` (boolean, default `true`) — turn the MCP server on/off.
- `mockaccino.mcp.enableClangBackend` (boolean, default `false`) — allow the `clang`
  backend over MCP.
- `mockaccino.mcp.enableAiBackend` (boolean, default `false`) — allow the `ai`
  backend over MCP.
- `mockaccino.ai.preferredModelSource` (`"sampling" | "vscodeLm"`, default
  `"sampling"`) — preferred model source for the AI backend; falls back to the other
  on failure (see "load-bearing decision" above).
- (regex over MCP is always on — no setting.)

The MCP tool layer reads these and only advertises/accepts the enabled backends;
regex is unconditional.

## Phase 3 — the MCP server

- `src/mcp_server.ts`: build an `McpServer` (`@modelcontextprotocol/sdk`) with two
  tools mirroring the palette:
  - `mockaccino_generate_mock` — input `{ path?, backend, outputDir? }`
  - `mockaccino_generate_stub` — input `{ path?, backend, outputDir? }`
  - `backend`: `"regex" | "clang" | "ai"` — filtered by the settings gates;
    `clang`/`ai` rejected with a clear message when disabled.
  - `path` (decided): optional — **both** supported. If given, read that file
    (absolute or workspace-relative); if omitted, fall back to the **active
    editor's** file.
  - `outputDir` (decided): optional — overrides where files are written for this
    call. When omitted, the configured `mockaccino.outputPath` default is used, and
    the tool result **reports the default output directory currently configured** so
    the client knows where files land (and that it can override).
- The tool handler reads the source, constructs the chosen backend (for `ai`, the
  `complete` provider follows the preferred-source + fallback order above), runs
  `mock()`/`stub()`, and returns a result containing:
  - the **written file paths**;
  - the **effective output directory** and the **configured default output
    directory**;
  - for the `ai` backend, the **`modelSource` actually used** (`sampling` / `vscodeLm`);
  - the **comment-stripped key content** of each generated file (strip the header
    banner + `/* */`/`//` comments — reuse the comment-removal logic; for a mock,
    that surfaces the `MOCK_METHOD` class + wrappers; for a stub, the signatures +
    returns) so the model can act on it without re-reading.
- Host as an in-process HTTP server; register via the VS Code MCP provider API so
  Copilot finds it; document the Claude Code config snippet.

## Phase 4 — docs + tests + wiring

- `extension.ts`: register the AI commands and start/stop the MCP server on
  activate/deactivate; gather the `complete` providers.
- Unit tests: `ai_parser` (pure), settings-gating logic (pure), tool input handling
  (pure where possible).
- Integration: extend the mandatory suite to compile an AI-backend-generated mock
  using a **fixed/stubbed** function list (so it runs without a live model), proving
  the AI path's output compiles like the others.
- Update `README.md` and `CLAUDE.md` (new backend, commands, settings, MCP usage for
  both Copilot and Claude Code).

## Decisions (resolved)

1. **Model source** — configurable `mockaccino.ai.preferredModelSource`, with
   automatic fallback to the other source on failure, and the method actually used
   reported back. ✅
2. **Tool granularity** — two tools (`..._mock`, `..._stub`); parsing method is the
   `backend` argument. ✅
3. **Input** — both a file `path` and the active-editor fallback; plus an optional
   `outputDir` override, and the tool reports the configured default output dir. ✅

## Decisions (resolved) — continued

4. **Claude Code wiring** — **auto-write** (option a): a command writes/updates the
   MCP server entry in Claude Code's config with the current server URL. ✅
5. **Hosting** — **extension-hosted** server (in the extension host). Standalone /
   CLI-without-VS-Code is **deferred**; the user runs Claude Code inside VS Code for
   now. Server only reachable while VS Code is open; port pinned/persisted. ✅

## Still open

- **Report-back digest** — default (assumed): the generated file with comments
  stripped. Say if you'd rather have something more selective (only `MOCK_METHOD`
  lines / only signatures).
- **Settings names** — default (assumed) as listed in Phase 2.

## Background on (4): why Claude Code needs separate wiring

VS Code's Copilot **auto-discovers** an MCP server that an extension contributes
(through the provider API). The **Claude Code extension is a different MCP client**
with its **own** server configuration — it does not look at VS Code's contributed
servers. So for Claude Code to see Mockaccino's tools, an entry pointing at the same
in-extension server (its localhost HTTP URL) must exist in Claude Code's MCP config.

Two ways to provide that entry:

- **(a) Auto-write** — a command, e.g. "Mockaccino: add MCP server to Claude Code",
  that writes/updates the entry in Claude Code's MCP config (project `.mcp.json` or
  user config) with the current server URL. Lower friction; the extension edits
  another tool's config file.
- **(b) Docs only** — we document the snippet and the user pastes it into their
  Claude Code MCP config themselves. Zero magic; the user stays in control.

Caveat either way: the server is hosted **inside the extension host**, so it's only
reachable **while VS Code is open**, and the localhost **port must be stable/known**
(we'd pin or persist it). If you primarily drive Claude Code as a standalone CLI
*without* VS Code running, an extension-hosted server can't serve it — that would
argue for the standalone-server option we set aside. Worth confirming your Claude
Code usage (inside VS Code vs standalone CLI).
