// Post-process the VS Code suite's coverage to the extension's own sources.
//
// @vscode/test-cli measures the *bundled* dist/extension.js, then expands it
// through the source map into every inlined source — including bundled deps
// under node_modules (@hono, the MCP SDK, ajv, zod). Its exclude runs at the
// bundle-file granularity, so those mapped sources slip through. This prunes
// the lcov to src/*.ts records and drops the node_modules HTML subtree, so the
// artifact reflects only the extension code the acceptance/extension tests hit.
//
// Usage: node scripts/filter-vscode-coverage.mjs [coverageDir=coverage/vscode]

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = process.argv[2] || join('coverage', 'vscode');
const lcovPath = join(dir, 'lcov.info');

if (!existsSync(lcovPath)) {
	console.error(`[filter-coverage] no lcov at ${lcovPath} — nothing to do`);
	process.exit(0);
}

const keepRecord = (record) => {
	const m = record.match(/^SF:(.*)$/m);
	if (!m) {
		return false;
	}
	const p = m[1].replace(/\\/g, '/');
	return /(^|\/)src\//.test(p) && !/node_modules/.test(p) && !/\/test\//.test(p);
};

const records = readFileSync(lcovPath, 'utf8').split('end_of_record\n');
let kept = 0;
let lf = 0;
let lh = 0;
const out = [];
for (const record of records) {
	if (!keepRecord(record)) {
		continue;
	}
	kept++;
	const a = record.match(/^LF:(\d+)/m);
	const b = record.match(/^LH:(\d+)/m);
	if (a) {
		lf += Number(a[1]);
	}
	if (b) {
		lh += Number(b[1]);
	}
	out.push(record.replace(/^\n+/, '') + 'end_of_record');
}

writeFileSync(lcovPath, out.join('\n') + '\n');

// Drop the bundled-dependency HTML so the browsable report is extension-only.
rmSync(join(dir, 'node_modules'), { recursive: true, force: true });

const pct = lf ? ((100 * lh) / lf).toFixed(1) : '0.0';
console.log(`[filter-coverage] ${dir}: kept ${kept} src file(s), line coverage ${pct}% (${lh}/${lf})`);

// Regenerate the HTML report from the filtered lcov when genhtml (lcov pkg) is
// available, so the browsable report matches. Otherwise the existing HTML stays
// (with the node_modules subtree pruned above) — the lcov is the source of truth.
const genhtml = spawnSync('genhtml', [lcovPath, '--output-directory', dir, '--quiet'], {
	stdio: 'ignore',
});
if (genhtml.status === 0) {
	console.log('[filter-coverage] regenerated HTML from filtered lcov (genhtml)');
} else {
	console.log('[filter-coverage] genhtml not available — kept existing HTML (lcov is filtered)');
}
