const { spawn } = require("child_process");

const claudeCliIsWin = process.platform === "win32";

interface SpawnResult {
	status: number | null;
	stdout: string;
	stderr: string;
	error?: string;
}

/* AI model-source provider that runs the `claude` CLI in print mode (`claude -p`)
   and returns its stdout. The prompt is delivered on **stdin** rather than as an
   argument, so large files don't hit command-line length limits. Spawning is
   injected (`spawnFn`), so the argument-building and result handling are
   unit-testable without the CLI installed.

   Exposes `complete(prompt) => Promise<string>` — the same provider shape the AI
   backend consumes, independent of MCP sampling and `vscode.lm`. */
class ClaudeCliCompletion {
	constructor(
		private claudePath: string,
		private extraArgs: string[] = [],
		private spawnFn: (cmd: string, args: string[], input: string) => Promise<SpawnResult> = ClaudeCliCompletion.defaultSpawn,
	) {}

	complete = async (prompt: string): Promise<string> => {
		const cmd = this.claudePath && this.claudePath.trim().length > 0 ? this.claudePath.trim() : "claude";
		const res = await this.spawnFn(cmd, ClaudeCliCompletion.buildArgs(this.extraArgs), prompt);
		if (res.error) {
			throw new Error(`Failed to run the claude CLI at '${cmd}': ${res.error}`);
		}
		if (res.status !== 0) {
			throw new Error(`claude CLI exited with ${res.status}: ${(res.stderr || "").trim() || "(no stderr)"}`);
		}
		return res.stdout;
	};

	/* `-p` (print/non-interactive) plus any user-supplied extra args (e.g. --model). */
	static buildArgs(extraArgs: string[] = []): string[] {
		const extra = Array.isArray(extraArgs)
			? extraArgs.filter((a) => typeof a === "string" && a.trim().length > 0).map((a) => a.trim())
			: [];
		return ["-p", ...extra];
	}

	static defaultSpawn(cmd: string, args: string[], input: string): Promise<SpawnResult> {
		return new Promise((resolve) => {
			let stdout = "";
			let stderr = "";
			const cp = spawn(cmd, args, { shell: claudeCliIsWin }); // resolve claude(.cmd) via PATH on Windows
			cp.on("error", (err: any) => resolve({ status: null, stdout, stderr, error: err && err.message ? err.message : String(err) }));
			cp.stdout.on("data", (d: any) => { stdout += d.toString(); });
			cp.stderr.on("data", (d: any) => { stderr += d.toString(); });
			cp.on("close", (code: number | null) => resolve({ status: code, stdout, stderr }));
			try {
				cp.stdin.write(input);
				cp.stdin.end();
			} catch {
				/* the error handler above resolves the promise */
			}
		});
	}
}

if (typeof module === "object") {
	module.exports = ClaudeCliCompletion;
}
