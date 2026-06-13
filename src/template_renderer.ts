var Interpolator = require("./interpolator");
const fs = require('fs');
const path = require('path');

/* Reads a template file from disk and fills it via the Interpolator. The only
   thing in the pipeline that touches templates, so the template directory layout
   and the `instance.*` contract live here (SRP). `context` is the object the
   templates reference as `instance`; the renderer treats it as opaque (DIP). */
class TemplateRenderer {
	constructor(private template_path: string, private context: any) {}

	renderMockHeader(mock_strings: string): string {
		return this.render('mock_header_template.h', "Mock", { mock_strings });
	}

	renderMockSrc(impl_strings: string): string {
		return this.render('mock_src_template.cc', "Mock", { impl_strings });
	}

	renderStubSrc(stub_strings: string): string {
		return this.render('stub_src_template.cc', "Stub", { stub_strings });
	}

	private render(templateFile: string, header_type_name: string, vars: any): string {
		const template_file_path = path.join(this.template_path, templateFile);
		let template_file_contents: string;
		try {
			template_file_contents = fs.readFileSync(template_file_path, "utf8");
		} catch (err) {
			console.warn(`Could not read template file '${template_file_path}': ${err}`);
			throw err;
		}

		const interpolator = new Interpolator(Object.assign({
			instance: this.context,
			header_type_name: header_type_name,
			header_type_name_lower: header_type_name.toLowerCase(),
		}, vars));
		return interpolator.interpolate(template_file_contents);
	}
}

if (typeof module === "object") {
	module.exports = TemplateRenderer;
}
