const fs = require('fs');

/* Writes generated content to disk. The only thing in the pipeline that touches
   the filesystem, so output-path resolution and the default-path fallback live
   here (SRP). Returns the path treated as the primary "file written". */
class FileWriter {
	constructor(private output_path: string, private naming: any) {}

	writeMock(header: string, src: string): string {
		const headerPath = this.resolve(this.naming.name + '_mock.h', this.naming.defaultMockHeaderPath);
		const srcPath = this.resolve(this.naming.name + '_mock.cc', this.naming.defaultMockSrcPath);
		console.log(`Writing mock files to: ${headerPath} and ${srcPath}`);
		fs.writeFileSync(headerPath, header, { flag: 'w' });
		fs.writeFileSync(srcPath, src, { flag: 'w' });
		return headerPath;
	}

	writeStub(src: string): string {
		const srcPath = this.resolve(this.naming.name + '_stub.cc', this.naming.defaultStubSrcPath);
		console.log(`Writing stub file to: ${srcPath}`);
		fs.writeFileSync(srcPath, src, { flag: 'w' });
		return srcPath;
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
