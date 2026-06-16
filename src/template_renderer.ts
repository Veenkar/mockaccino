var Interpolator = require("./interpolator");
const fs = require('fs');
const path = require('path');

/* Reads a template file from disk and fills it via the Interpolator. The only
   thing in the pipeline that touches templates, so the template directory layout
   and the `instance.*` contract live here (SRP). `context` is the object the
   templates reference as `instance`; the renderer treats it as opaque (DIP). */
class TemplateRenderer {
	constructor(private template_path: string, private context: any) {}

	/* A single header holds both kinds of mock. `mock_strings` are the C
	   MOCK_METHOD entries (empty when the file has no C free functions);
	   `mock_classes` are the rendered gmock C++ class blocks (empty when none).
	   At least one is non-empty (the base errors out otherwise). */
	renderMockHeader(mock_strings: string, mock_classes: string): string {
		const includes = this.buildIncludes(mock_strings, mock_classes);
		const mock_body = this.buildMockBody(mock_strings, mock_classes);
		return this.render('mock_header_template.h', "Mock", { includes, mock_body });
	}

	renderMockSrc(impl_strings: string): string {
		return this.render('mock_src_template.cc', "Mock", { impl_strings });
	}

	renderStubSrc(stub_strings: string): string {
		return this.render('stub_src_template.cc', "Stub", { stub_strings });
	}

	/* The original header is pulled in differently depending on what we mock.
	   A pure C header has no linkage of its own, so its declarations are wrapped
	   in `extern "C"` (guarded by __cplusplus, as a header should be). As soon as
	   C++ classes are involved the input is a C++/mixed header that manages its
	   own linkage, so it is included verbatim. */
	private buildIncludes(mock_strings: string, mock_classes: string): string {
		const lines = ['#include <gmock/gmock.h>'];
		if (mock_classes) {
			lines.push(`#include "${this.context.filename}"`);
		} else {
			lines.push('#ifdef __cplusplus');
			lines.push('extern "C" {');
			lines.push('#endif');
			lines.push(`#include "${this.context.header_name}"`);
			lines.push('#ifdef __cplusplus');
			lines.push('}');
			lines.push('#endif');
		}
		return lines.join('\n');
	}

	/* The mock declarations: the C mock class (forwarded to by the .cc wrappers)
	   and/or the gmock C++ class mocks, each under its own banner, only when the
	   corresponding kind was found. */
	private buildMockBody(mock_strings: string, mock_classes: string): string {
		const banner = (title: string) =>
			`/*===========================================================================*\n`
			+ ` * ${title}\n`
			+ ` *===========================================================================*/`;
		const sections: string[] = [];
		if (mock_strings) {
			const m = this.context.mock_name;
			sections.push(
				`${banner('Mock class declarations for global functions')}\n`
				+ `class ${m} {\n`
				+ `public:\n`
				+ `\t${m}();\n`
				+ `\tvirtual ~${m}();\n`
				+ `${mock_strings}\n`
				+ `};`
			);
		}
		if (mock_classes) {
			sections.push(`${banner('Mock class declarations for interfaces')}\n${mock_classes}`);
		}
		return sections.join('\n\n');
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
