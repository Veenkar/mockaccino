const fs = require('fs');

/* Writes generated content to disk. The only thing in the pipeline that touches
   the filesystem, so output-path resolution and the default-path fallback live
   here (SRP). Returns the path treated as the primary "file written". */
class FileWriter {
	constructor(private output_path: string, private naming: any) {}

	/* The single mock header (`_mock.h`): holds the C mock class and/or the gmock
	   C++ class mocks. Always written when there is anything to mock. */
	writeMockHeader(header: string): string[] {
		const headerPath = this.resolve(this.naming.name + '_mock.h', this.naming.defaultMockHeaderPath);
		console.log(`Writing mock header to: ${headerPath}`);
		fs.writeFileSync(headerPath, header, { flag: 'w' });
		return [headerPath];
	}

	/* The C-wrapper source (`_mock.cc`): only written when the file has C free
	   functions (the C++ class mocks are header-only). */
	writeMockSrc(src: string): string[] {
		const srcPath = this.resolve(`${this.naming.name}_mock.${this.naming.sourceExt}`, this.naming.defaultMockSrcPath);
		console.log(`Writing mock source to: ${srcPath}`);
		fs.writeFileSync(srcPath, src, { flag: 'w' });
		return [srcPath];
	}

	writeStub(src: string): string[] {
		const srcPath = this.resolve(`${this.naming.name}_stub.${this.naming.sourceExt}`, this.naming.defaultStubSrcPath);
		console.log(`Writing stub file to: ${srcPath}`);
		fs.writeFileSync(srcPath, src, { flag: 'w' });
		return [srcPath];
	}

	/* Place the file under the configured output directory if one is set,
	   otherwise next to the input file using the default path. */
	private resolve(outName: string, defaultPath: string): string {
		if (this.output_path && this.output_path.length > 0) {
			fs.mkdirSync(this.output_path, { recursive: true });
			return this.output_path + '/' + outName;
		}
		return defaultPath;
	}
}

if (typeof module === "object") {
	module.exports = FileWriter;
}
