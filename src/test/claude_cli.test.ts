import * as assert from 'assert';

const ClaudeCliCompletion = require('../claude_cli');

suite('ClaudeCliCompletion.buildArgs', () => {
	test('defaults to print mode', () => {
		assert.deepStrictEqual(ClaudeCliCompletion.buildArgs(), ['-p']);
	});

	test('appends trimmed non-empty extra args', () => {
		assert.deepStrictEqual(
			ClaudeCliCompletion.buildArgs(['--model', ' sonnet ', '', '  ']),
			['-p', '--model', 'sonnet'],
		);
	});
});

suite('ClaudeCliCompletion.complete', () => {
	// A fake spawn that records how it was called and returns a canned result.
	function fakeSpawn(result: any) {
		const calls: any[] = [];
		const fn = async (cmd: string, args: string[], input: string) => {
			calls.push({ cmd, args, input });
			return result;
		};
		return { fn, calls };
	}

	test('passes the prompt on stdin and returns stdout', async () => {
		const spy = fakeSpawn({ status: 0, stdout: '[{"name":"f"}]', stderr: '' });
		const provider = new ClaudeCliCompletion('', [], spy.fn);
		const out = await provider.complete('PROMPT');
		assert.strictEqual(out, '[{"name":"f"}]');
		assert.strictEqual(spy.calls[0].cmd, 'claude'); // empty path -> PATH lookup
		assert.deepStrictEqual(spy.calls[0].args, ['-p']);
		assert.strictEqual(spy.calls[0].input, 'PROMPT'); // prompt via stdin, not args
	});

	test('uses the configured claude path when given', async () => {
		const spy = fakeSpawn({ status: 0, stdout: 'ok', stderr: '' });
		await new ClaudeCliCompletion('C:/tools/claude.exe', ['--model', 'opus'], spy.fn).complete('x');
		assert.strictEqual(spy.calls[0].cmd, 'C:/tools/claude.exe');
		assert.deepStrictEqual(spy.calls[0].args, ['-p', '--model', 'opus']);
	});

	test('throws on a non-zero exit, surfacing stderr', async () => {
		const spy = fakeSpawn({ status: 2, stdout: '', stderr: 'boom' });
		await assert.rejects(() => new ClaudeCliCompletion('', [], spy.fn).complete('x'), /exited with 2: boom/);
	});

	test('throws when the process fails to start', async () => {
		const spy = fakeSpawn({ status: null, stdout: '', stderr: '', error: 'ENOENT' });
		await assert.rejects(() => new ClaudeCliCompletion('claude', [], spy.fn).complete('x'), /Failed to run the claude CLI.*ENOENT/);
	});
});
