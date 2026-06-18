// One-off helper: regenerate the inline-mock acceptance goldens by running the
// real RegexMockaccino.mockInline with the package.json default config (exactly
// what the acceptance test pins). Run: node scripts/gen-inline-goldens.js
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const RegexMockaccino = require(path.join(repoRoot, 'out', 'regex_mockaccino'));
const pkg = require(path.join(repoRoot, 'package.json'));
const props = pkg.contributes.configuration.properties;

function makeConfig() {
	const values = {};
	for (const k of Object.keys(props)) {
		values[k.replace(/^mockaccino\./, '')] = props[k].default;
	}
	values.outputPath = '';
	const cfg = { get: (k) => values[k] };
	cfg.disableDoubleMocking = values.disableDoubleMocking;
	return cfg;
}

const templates = path.join(repoRoot, 'templates');
const cases = [
	['src/test/fixtures/iface_hpp/iface.hpp', 'src/test/fixtures/iface_hpp/expected/iface_inline.hpp'],
	['src/test/fixtures/mixed_hpp/mixed.hpp', 'src/test/fixtures/mixed_hpp/expected/mixed_inline.hpp'],
];

const origLog = console.log;
console.log = () => {};
for (const [inp, outp] of cases) {
	const inPath = path.join(repoRoot, inp);
	const content = fs.readFileSync(inPath, 'utf8');
	const uri = { fsPath: inPath, scheme: 'file' };
	const m = new RegexMockaccino(content, uri, makeConfig(), '0.0.0', '', templates);
	const res = m.mockInline(content);
	console.log = origLog;
	if (!res.changed) {
		console.error(`NO CHANGE for ${inp}: ${res.message}`);
		process.exit(1);
	}
	fs.writeFileSync(path.join(repoRoot, outp), res.content);
	console.log(`wrote ${outp} — ${res.message}`);
	console.log = () => {};
}
console.log = origLog;
