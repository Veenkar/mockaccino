// Standalone MCP client probe — verifies the running Mockaccino MCP server
// independently of Copilot / Claude Code. It performs the real MCP handshake over
// Streamable HTTP and lists the tools the server exposes.
//
//   node scripts/mcp-probe.js [url]
//
// Default url is http://127.0.0.1:57354/mcp — pass the port from the Mockaccino
// log line "MCP server listening at http://127.0.0.1:<port>/mcp".
//
// If it prints the two mockaccino_* tools, the SERVER is correct and the problem
// is client-side (enable the tools / agent mode / restart the client). If it
// errors, the error points at the server handshake.

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

(async () => {
	const url = process.argv[2] || 'http://127.0.0.1:57354/mcp';
	console.log(`Connecting to ${url} ...`);
	const transport = new StreamableHTTPClientTransport(new URL(url));
	const client = new Client({ name: 'mockaccino-probe', version: '0.0.0' });
	await client.connect(transport);
	console.log('Connected. Server:', JSON.stringify(client.getServerVersion()));

	const tools = await client.listTools();
	console.log(`\nTools exposed (${tools.tools.length}):`);
	for (const t of tools.tools) {
		console.log(`  - ${t.name}: ${t.description || ''}`);
	}

	await client.close();
	console.log('\nOK — the server is serving tools. If your AI client does not see them, the issue is client-side.');
})().catch((err) => {
	console.error('\nPROBE FAILED:', err && err.message ? err.message : err);
	console.error('If this fails but the Mockaccino log shows "listening", the server handshake has a bug — share this error.');
	process.exit(1);
});
