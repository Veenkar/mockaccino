/* Value object the templates reference as `instance.*`. Aggregates the names
   derived by Naming with the per-run document-header metadata (version, build
   time, copyright) so the renderer has a single, explicit object to fill the
   templates from, and Mockaccino no longer has to mirror those values as its
   own fields (SRP). Holds no behaviour. */
var Naming = require("./naming");

class TemplateContext {
	readonly name: string;
	readonly caps_name: string;
	readonly header_name: string;
	readonly mock_name: string;
	readonly mock_instance_name: string;
	readonly caps_mock_name: string;
	readonly caps_stub_name: string;
	readonly filename: string;
	readonly version: string;
	readonly localTime: string;
	readonly copyright: string;

	constructor(naming: typeof Naming, version: string, localTime: string, copyright: string) {
		this.name = naming.name;
		this.caps_name = naming.caps_name;
		this.header_name = naming.header_name;
		this.mock_name = naming.mock_name;
		this.mock_instance_name = naming.mock_instance_name;
		this.caps_mock_name = naming.caps_mock_name;
		this.caps_stub_name = naming.caps_stub_name;
		this.filename = naming.filename;
		this.version = version;
		this.localTime = localTime;
		this.copyright = copyright;
	}
}

if (typeof module === "object") {
	module.exports = TemplateContext;
}
