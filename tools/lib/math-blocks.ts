/**
 * Normalises single-line `$$…$$` math into the fenced form.
 *
 * Obsidian renders every `$$…$$` as a display block regardless of how it is
 * laid out. Quartz's remark-math is stricter: it only produces a math block
 * when the delimiters sit on their own lines, and treats a one-line `$$…$$`
 * as inline math absorbed into the surrounding paragraph. The two renderers
 * therefore disagree on the same source, which is what this module fixes —
 * by rewriting the text before parsing rather than by editing the notes, so
 * `$$…$$` stays the convenient thing to type.
 *
 * Spans already written in the fenced form span multiple lines and so are
 * left alone by construction.
 *
 * Known limitation: a `$$…$$` inside an inline code span (between single
 * backticks) is promoted too. Fenced code blocks are skipped, which covers
 * the case that actually occurs; inline spans are not tracked.
 */

/** Opens or closes a fenced code block: ``` or ~~~, optionally indented. */
const FENCE = /^\s*(`{3,}|~{3,})/;

/** `$$…$$` with no newline between the delimiters, i.e. the non-fenced form. */
const INLINE_DISPLAY = /\$\$([^\n]+?)\$\$/;

/**
 * A closing fence must use the same character as the opener and be at least
 * as long, per CommonMark.
 */
function closesFence(open: string, candidate: string): boolean {
	return candidate[0] === open[0] && candidate.length >= open.length;
}

/**
 * Expands one line into the lines that replace it. A line with no single-line
 * `$$…$$` is returned unchanged, so the common case allocates nothing extra.
 */
function promoteLine(line: string): string[] {
	if (!line.includes("$$")) return [line];

	const parts: string[] = [];
	let rest = line;
	let matched = false;

	while (true) {
		const match = INLINE_DISPLAY.exec(rest);
		if (match === null) break;

		matched = true;
		const before = rest.slice(0, match.index).trim();
		if (before !== "") parts.push(before);
		parts.push("", "$$", match[1].trim(), "$$", "");
		rest = rest.slice(match.index + match[0].length);
	}

	if (!matched) return [line];

	const after = rest.trim();
	if (after !== "") parts.push(after);
	return parts;
}

/**
 * Rewrites every single-line `$$…$$` in `src` into a fenced math block
 * surrounded by blank lines. Runs of blank lines outside fenced code are
 * collapsed to one, so the blanks this adds next to existing ones do not
 * accumulate; that is a whitespace-only change with no effect on the parse.
 */
export function promoteDisplayMath(src: string): string {
	const out: string[] = [];
	let fence: string | null = null;

	const push = (line: string) => {
		if (line === "" && out[out.length - 1] === "") return;
		out.push(line);
	};

	for (const line of src.split("\n")) {
		const fenceMatch = FENCE.exec(line);

		if (fence !== null) {
			out.push(line);
			if (fenceMatch !== null && closesFence(fence, fenceMatch[1]))
				fence = null;
			continue;
		}

		if (fenceMatch !== null) {
			fence = fenceMatch[1];
			out.push(line);
			continue;
		}

		for (const produced of promoteLine(line)) push(produced);
	}

	return out.join("\n");
}
