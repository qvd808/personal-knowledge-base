/**
 * Keeps an Obsidian block anchor alive when it marks a display-math block.
 *
 * Obsidian lets a `^block-id` line follow any block, math included, and
 * resolves `[[note#^block-id]]` itself. Quartz instead needs a real HTML `id`
 * on the page, and its Obsidian-flavoured-markdown plugin puts one there by
 * finding the `^id` paragraph and moving the id onto the element above it.
 * For math that element is the one `rehype-katex` later rebuilds from scratch,
 * and the id goes with it: the link renders fine, the target silently does not
 * exist, and the only trace on the page is an empty `<p></p>`.
 *
 * The fix is to give the id to a wrapper that KaTeX has no reason to touch.
 * Each anchored block is wrapped in a `<div id="…">` and the `^id` line is
 * dropped, so the anchor survives however the math inside is re-rendered.
 * Blank lines inside the wrapper keep the math parsed as markdown rather than
 * swallowed as raw HTML.
 *
 * Runs on raw file text before parsing, and before `promoteDisplayMath`, so
 * both spellings of a display block are still intact:
 *
 *     $$            and     $$…$$
 *     …                     ^block-id
 *     $$
 *     ^block-id
 *
 * The notes keep the plain Obsidian form either way — nothing here is written
 * to disk.
 *
 * Known limitation: Quartz never learns about these blocks, so a transclusion
 * (`![[note#^block-id]]`) of an anchored math block still will not resolve.
 * Links to it, which is what the anchor is for, do.
 */

/** Opens or closes a fenced code block: ``` or ~~~, optionally indented. */
const FENCE = /^\s*(`{3,}|~{3,})/;

/** A block anchor on a line of its own, using Obsidian's id alphabet. */
const BLOCK_ANCHOR = /^\^([-_A-Za-z0-9]+)\s*$/;

/** A whole display block written on one line, `$$…$$`. */
const ONE_LINE_DISPLAY = /^\$\$.*\$\$$/;

interface AnchoredBlock {
	/** First line of the math block. */
	start: number;
	/** Last line of the math block. */
	end: number;
	/** The `^id` line, which is dropped. */
	anchorLine: number;
	id: string;
}

/**
 * A closing fence must use the same character as the opener and be at least
 * as long, per CommonMark.
 */
function closesFence(open: string, candidate: string): boolean {
	return candidate[0] === open[0] && candidate.length >= open.length;
}

/** The anchor id on `line`, or null when it is not an anchor line. */
function anchorId(line: string | undefined): string | null {
	if (line === undefined) return null;
	const match = BLOCK_ANCHOR.exec(line);
	return match?.[1] ?? null;
}

/**
 * Every display-math block in `lines` that is immediately followed by a block
 * anchor. Fenced code is skipped, so a fence demonstrating the form is safe.
 */
function findAnchoredBlocks(lines: string[]): AnchoredBlock[] {
	const found: AnchoredBlock[] = [];
	let fence: string | null = null;
	let mathStart: number | null = null;

	const record = (start: number, end: number): void => {
		const id = anchorId(lines[end + 1]);
		if (id !== null) found.push({ start, end, anchorLine: end + 1, id });
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const fenceMatch = FENCE.exec(line);

		if (fence !== null) {
			if (fenceMatch !== null && closesFence(fence, fenceMatch[1] ?? ""))
				fence = null;
			continue;
		}
		if (mathStart === null && fenceMatch !== null) {
			fence = fenceMatch[1] ?? null;
			continue;
		}

		const trimmed = line.trim();
		if (mathStart !== null) {
			if (trimmed === "$$") {
				record(mathStart, i);
				mathStart = null;
			}
			continue;
		}
		if (trimmed === "$$") {
			mathStart = i;
		} else if (ONE_LINE_DISPLAY.test(trimmed)) {
			record(i, i);
		}
	}

	return found;
}

/**
 * Wraps every anchored display-math block in `src` in a `<div id="…">` and
 * drops the `^id` line. Returns `src` unchanged when there is nothing to wrap.
 */
export function anchorDisplayMath(src: string): string {
	const lines = src.split("\n");
	const blocks = findAnchoredBlocks(lines);
	if (blocks.length === 0) return src;

	const opensAt = new Map(blocks.map((block) => [block.start, block]));
	const closesAt = new Set(blocks.map((block) => block.end));
	const dropped = new Set(blocks.map((block) => block.anchorLine));

	const out: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (dropped.has(i)) continue;

		const opening = opensAt.get(i);
		if (opening !== undefined) {
			out.push("", `<div id="${opening.id}">`, "");
		}
		out.push(lines[i] ?? "");
		if (closesAt.has(i)) {
			out.push("", "</div>", "");
		}
	}
	return out.join("\n");
}
