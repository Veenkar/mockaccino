/* Pure (vscode-free, unit-tested) helper for the "inline mock" path: instead of
   writing a separate _mock.h, the generated gmock mock-class blocks are injected
   directly into the source file. The block is wrapped in BEGIN/END markers (so a
   re-run can find and replace it in place) and behind an `#ifdef <guard>` so the
   mocks only compile in the test build. Placement: just before the file's closing
   include-guard `#endif`, and before any trailing end-of-file comments.

   No filesystem / vscode here — the caller decides how to apply the new content
   (an undoable editor edit, or a write to disk). */

const DEFAULT_BEGIN_MARKER = '// >>> MOCKACCINO INLINE MOCKS (generated; re-run to regenerate) >>>';
const DEFAULT_END_MARKER = '// <<< MOCKACCINO INLINE MOCKS (end) <<<';
const DEFAULT_GUARD_MACRO = 'MOCKACCINO_INLINE_MOCKS';

interface InlineOptions {
	guardMacro?: string;
	beginMarker?: string;
	endMarker?: string;
	eol?: string;
}

interface InlineResult {
	content: string;
	changed: boolean;
	/* inserted: a fresh block was added; replaced: an existing marked block was
	   regenerated; present: the mock classes already exist (outside markers) so
	   nothing was added; empty: no mock classes were supplied. */
	status: 'inserted' | 'replaced' | 'present' | 'empty';
	count: number;
}

function detectEol(source: string): string {
	return /\r\n/.test(source) ? '\r\n' : '\n';
}

/* Replace every comment (and the contents of string/char literals) with
   same-length spaces, preserving newlines, so the result indexes identically to
   the source. Lets us find the last real "code" offset without tripping over a
   `//` inside a string or a trailing comment. */
function blankComments(src: string): string {
	let out = '';
	let i = 0;
	const n = src.length;
	while (i < n) {
		const c = src[i];
		const c2 = i + 1 < n ? src[i + 1] : '';
		if (c === '/' && c2 === '/') {
			while (i < n && src[i] !== '\n') { out += ' '; i++; }
		} else if (c === '/' && c2 === '*') {
			out += '  '; i += 2;
			while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
				out += src[i] === '\n' ? '\n' : ' ';
				i++;
			}
			if (i < n) { out += '  '; i += 2; }
		} else if (c === '"' || c === "'") {
			const quote = c;
			out += c; i++;
			while (i < n && src[i] !== quote) {
				if (src[i] === '\\' && i + 1 < n) { out += '  '; i += 2; continue; }
				out += src[i] === '\n' ? '\n' : ' ';
				i++;
			}
			if (i < n) { out += src[i]; i++; }
		} else {
			out += c; i++;
		}
	}
	return out;
}

/* Offset at which to splice the inline block. Skips trailing whitespace/comments
   to find the last line of real code; if that line is a closing-guard `#endif`,
   the block goes *before* it (staying inside the guard), otherwise *after* it
   (before the trailing comments we skipped). */
function findInsertionOffset(source: string): number {
	const blanked = blankComments(source);
	let last = -1;
	for (let i = blanked.length - 1; i >= 0; i--) {
		if (!/\s/.test(blanked[i])) { last = i; break; }
	}
	if (last === -1) {
		return source.length; // no code at all — append
	}
	const lineStart = source.lastIndexOf('\n', last) + 1;
	let lineEnd = blanked.indexOf('\n', last);
	if (lineEnd === -1) { lineEnd = source.length; }
	const codeLine = blanked.slice(lineStart, lineEnd);
	if (/^\s*#\s*endif\b/.test(codeLine)) {
		return lineStart; // before the closing include guard
	}
	return lineEnd < source.length ? lineEnd + 1 : source.length;
}

/* Build the marker-delimited, `#ifdef`-guarded block (no surrounding newlines). */
function buildInlineBlock(classBlocks: string[], guardMacro: string, begin: string, end: string, eol: string): string {
	const body = classBlocks.join('\n\n').replace(/\r\n/g, '\n');
	const lines = [
		begin,
		`#ifdef ${guardMacro}`,
		'#include <gmock/gmock.h>',
		'',
		body,
		'',
		`#endif  // ${guardMacro}`,
		end,
	];
	return lines.join('\n').replace(/\n/g, eol);
}

/* The mock class name each block declares, e.g. `class app_IFoo_Mock : ...` -> app_IFoo_Mock. */
function mockClassNameOf(block: string): string | undefined {
	const m = block.match(/\bclass\s+([A-Za-z_]\w*)/);
	return m ? m[1] : undefined;
}

/* Splice `block` into `source` at `off`, padding with blank lines so it never
   fuses onto adjacent code. */
function spliceBlock(source: string, off: number, block: string, eol: string): string {
	const pre = source.slice(0, off);
	const post = source.slice(off);
	let result = pre;
	if (pre.length > 0 && !/[\r\n]$/.test(pre)) {
		result += eol;
	}
	result += eol + block + eol;
	if (post.length > 0) {
		if (!/^[\r\n]/.test(post)) {
			result += eol;
		}
		result += post;
	}
	return result;
}

/* Inject the rendered mock-class blocks into `source`. See module header. */
function insertInlineMocks(source: string, classBlocks: string[], options: InlineOptions = {}): InlineResult {
	const eol = options.eol || detectEol(source);
	const guardMacro = options.guardMacro || DEFAULT_GUARD_MACRO;
	const begin = options.beginMarker || DEFAULT_BEGIN_MARKER;
	const end = options.endMarker || DEFAULT_END_MARKER;

	if (!classBlocks || classBlocks.length === 0) {
		return { content: source, changed: false, status: 'empty', count: 0 };
	}

	// An existing marked block is owned by Mockaccino — regenerate it wholesale.
	const beginIdx = source.indexOf(begin);
	if (beginIdx !== -1) {
		const endMarkerIdx = source.indexOf(end, beginIdx);
		if (endMarkerIdx !== -1) {
			const nl = source.indexOf('\n', endMarkerIdx);
			const afterStart = nl === -1 ? source.length : nl;
			const block = buildInlineBlock(classBlocks, guardMacro, begin, end, eol);
			const content = source.slice(0, beginIdx) + block + source.slice(afterStart);
			return { content, changed: content !== source, status: 'replaced', count: classBlocks.length };
		}
	}

	// No marked block: drop any class already declared elsewhere so a manual or
	// previously-pasted mock isn't duplicated.
	const blanked = blankComments(source);
	const remaining = classBlocks.filter((b) => {
		const name = mockClassNameOf(b);
		if (!name) { return true; }
		return !new RegExp(`\\bclass\\s+${name}\\b`).test(blanked);
	});
	if (remaining.length === 0) {
		return { content: source, changed: false, status: 'present', count: 0 };
	}

	const block = buildInlineBlock(remaining, guardMacro, begin, end, eol);
	const off = findInsertionOffset(source);
	const content = spliceBlock(source, off, block, eol);
	return { content, changed: true, status: 'inserted', count: remaining.length };
}

if (typeof module === 'object') {
	module.exports = {
		insertInlineMocks,
		buildInlineBlock,
		findInsertionOffset,
		blankComments,
		DEFAULT_GUARD_MACRO,
		DEFAULT_BEGIN_MARKER,
		DEFAULT_END_MARKER,
	};
}
