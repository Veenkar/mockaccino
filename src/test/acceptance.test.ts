import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Acceptance tests: drive the *real* VS Code commands end-to-end against fixture
// .c/.h files and compare the generated mock/stub files to committed golden files.
// This imports the `vscode` API, so it only runs inside the Electron host
// (`npm run test`); it is excluded from the fast `npm run test:unit` path.
import * as vscode from 'vscode';

// Fixtures live in the source tree (not copied to out/). out/test -> repo root.
const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures');

// The goldens were generated with the extension's *default* settings, so the test
// pins config to the package.json defaults to stay in lockstep with them.
const pkg = require('../../package.json');
const configProps: Record<string, any> = pkg.contributes.configuration.properties;
const configKeys: string[] = Object.keys(configProps).map((k) => k.replace(/^mockaccino\./, ''));

// Volatile values that change per run / release / year are rewritten to fixed
// placeholders on BOTH sides before comparison so the goldens stay stable.
function normalize(s: string): string {
	return s
		.replace(/\r\n/g, '\n')
		.replace(/^(\s*\*\s*TIME:).*$/gm, '$1 <TIME>')
		.replace(/^(\s*\*\s*VERSION:).*$/gm, '$1 <VERSION>')
		.replace(/(\(c\)\s*)\d{4}/g, '$1<YEAR>');
}

interface FixtureCase {
	caseName: string;
	inputPath: string;
	inputBasename: string;
	name: string;          // basename without extension, e.g. "main"
	expectedDir: string;
	hasMock: boolean;
	hasStub: boolean;
}

// Each subfolder of fixtures/ is a case: a single input file at its root plus an
// expected/ folder holding the golden <name>_mock.h / _mock.cc / _stub.cc.
function discoverCases(root: string): FixtureCase[] {
	const cases: FixtureCase[] = [];
	for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
		if (!dirent.isDirectory()) {
			continue;
		}
		const caseDir = path.join(root, dirent.name);
		const inputName = fs.readdirSync(caseDir, { withFileTypes: true })
			.find((e) => e.isFile())?.name;
		if (!inputName) {
			continue;
		}
		const name = inputName.replace(/\.[^.]+$/, '');
		const expectedDir = path.join(caseDir, 'expected');
		cases.push({
			caseName: dirent.name,
			inputPath: path.join(caseDir, inputName),
			inputBasename: inputName,
			name,
			expectedDir,
			hasMock: fs.existsSync(path.join(expectedDir, `${name}_mock.h`))
				|| fs.existsSync(path.join(expectedDir, `${name}_mock.cc`))
				|| fs.existsSync(path.join(expectedDir, `${name}_mock.hpp`)),
			hasStub: fs.existsSync(path.join(expectedDir, `${name}_stub.cc`)),
		});
	}
	return cases;
}

suite('Acceptance (commands + golden files)', () => {
	const cases = discoverCases(FIXTURES);
	let tmpDir: string;

	suiteSetup(async () => {
		const ext = vscode.extensions.getExtension('SelerLabs.mockaccino');
		assert.ok(ext, 'Mockaccino extension not found in the test host');
		await ext.activate();
	});

	async function pinConfig(outputPath: string) {
		const cfg = vscode.workspace.getConfiguration('mockaccino');
		for (const key of configKeys) {
			const value = key === 'outputPath' ? outputPath : configProps[`mockaccino.${key}`].default;
			await cfg.update(key, value, vscode.ConfigurationTarget.Global);
		}
	}

	async function restoreConfig() {
		const cfg = vscode.workspace.getConfiguration('mockaccino');
		for (const key of configKeys) {
			await cfg.update(key, undefined, vscode.ConfigurationTarget.Global);
		}
	}

	function compareGenerated(c: FixtureCase, suffixes: string[]) {
		for (const suffix of suffixes) {
			const expectedPath = path.join(c.expectedDir, `${c.name}${suffix}`);
			if (!fs.existsSync(expectedPath)) {
				continue;
			}
			const actualPath = path.join(tmpDir, `${c.name}${suffix}`);
			assert.ok(fs.existsSync(actualPath), `generator did not produce ${c.name}${suffix}`);
			const actual = normalize(fs.readFileSync(actualPath, 'utf8'));
			const expected = normalize(fs.readFileSync(expectedPath, 'utf8'));
			assert.strictEqual(actual, expected, `${c.name}${suffix} does not match the golden file`);
		}
	}

	for (const c of cases) {
		suite(`${c.caseName} (${c.inputBasename})`, () => {
			setup(async () => {
				tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockaccino-acc-'));
				await pinConfig(tmpDir);
				const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(c.inputPath));
				await vscode.window.showTextDocument(doc);
			});
			teardown(async () => {
				await restoreConfig();
				fs.rmSync(tmpDir, { recursive: true, force: true });
			});

			if (c.hasMock) {
				test('mock', async () => {
					await vscode.commands.executeCommand('mockaccino.mockCurrentFile');
					compareGenerated(c, ['_mock.h', '_mock.cc', '_mock.hpp']);
				});
			}
			if (c.hasStub) {
				test('stub', async () => {
					await vscode.commands.executeCommand('mockaccino.stubCurrentFile');
					compareGenerated(c, ['_stub.cc']);
				});
			}
		});
	}
});
