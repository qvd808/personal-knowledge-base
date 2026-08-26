/**
 * Block-reference anchors (#46).
 *
 * Quartz only strips the `^` from an anchor when the href names a note:
 * `CrawlLinks` skips `transformLink` for any href starting with `#`
 * (`links.ts:100`), and `transformLink` -> `splitAnchor` -> `slugAnchor` is
 * the only place the caret is removed. So `[text](#^id)` and `[[#^id|text]]`
 * both ship a caret no element id on the page carries, while
 * `[[note#^id|text]]` resolves. These helpers find both spellings and the
 * block markers they point at.
 */

/** A link pointing at a block id, in either spelling. */
export interface BlockReference {
	/** The note the link names, or null when it names none. */
	note: string | null;
	/** The block id, caret stripped. */
	id: string;
	/** Link text: the wikilink alias, or the Markdown link text. */
	text: string;
	/** Present only for a wikilink, and only when it carries an alias. */
	hasAlias: boolean;
	spelling: "markdown" | "wikilink";
	/** 1-based line number in the source. */
	line: number;
}

/** `[text](#^id)` and `[text](note#^id)`: any Markdown link with an anchor. */
const MARKDOWN_ANCHOR_LINK = /\[([^\]]*)\]\(([^)\s]*#[^)\s]*)\)/g;
/** `[[target]]` / `![[target]]`, alias and anchor left in the capture. */
const WIKILINK = /!?\[\[([^[\]]*)\]\]/g;
/** Obsidian's block marker, mirroring Quartz's own `blockReferenceRegex`. */
const BLOCK_MARKER = /\^([-_A-Za-z0-9]+)\s*$/;
const FENCE = /^\s*(?:```|~~~)/;

/**
 * Splits source into lines, marking those inside a fenced code block so
 * callers can skip them. Inline code spans are not tracked: a caret anchor
 * inside backticks on a prose line is rare enough to accept, and skipping
 * whole fences is what keeps a note that documents the convention from
 * failing the rule it documents.
 */
function proseLines(source: string): Array<{ text: string; line: number }> {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const out: Array<{ text: string; line: number }> = [];
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		const text = lines[i] ?? "";
		if (FENCE.test(text)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		out.push({ text, line: i + 1 });
	}
	return out;
}

/**
 * Every block reference in the source, in both spellings. Links with an
 * anchor but no caret (`](#some-heading)`, `[[note#Heading]]`) are heading
 * references, resolve correctly, and are not returned.
 */
export function extractBlockReferences(source: string): BlockReference[] {
	const refs: BlockReference[] = [];
	for (const { text: lineText, line } of proseLines(source)) {
		for (const match of lineText.matchAll(MARKDOWN_ANCHOR_LINK)) {
			const label = match[1] ?? "";
			const target = match[2] ?? "";
			const hash = target.indexOf("#");
			const anchor = target.slice(hash + 1);
			if (!anchor.startsWith("^")) continue;
			const note = hash === 0 ? null : target.slice(0, hash);
			refs.push({
				note,
				id: anchor.slice(1),
				text: label,
				hasAlias: false,
				spelling: "markdown",
				line,
			});
		}
		for (const match of lineText.matchAll(WIKILINK)) {
			const inner = match[1] ?? "";
			const pipe = inner.indexOf("|");
			const link = pipe === -1 ? inner : inner.slice(0, pipe);
			const alias = pipe === -1 ? undefined : inner.slice(pipe + 1);
			const hash = link.indexOf("#");
			if (hash === -1) continue;
			const anchor = link.slice(hash + 1);
			if (!anchor.startsWith("^")) continue;
			const note = hash === 0 ? null : link.slice(0, hash).trim();
			const id = anchor.slice(1).trim();
			refs.push({
				note: note === "" ? null : note,
				id,
				text: (alias ?? id).trim(),
				hasAlias: alias !== undefined,
				spelling: "wikilink",
				line,
			});
		}
	}
	return refs;
}

/**
 * The block ids a note defines: every trailing `^id` marker, matched the way
 * Quartz matches them so lint and the rendered site agree on what exists.
 */
export function extractBlockIds(source: string): Set<string> {
	const ids = new Set<string>();
	for (const { text } of proseLines(source)) {
		const match = BLOCK_MARKER.exec(text);
		if (match?.[1]) ids.add(match[1]);
	}
	return ids;
}

/** The wikilink spelling that fixes a caret anchor, for the rule message. */
export function suggestedSpelling(
	noteName: string,
	ref: BlockReference,
): string {
	const useAlias = ref.spelling === "markdown" || ref.hasAlias;
	return useAlias && ref.text !== ""
		? `[[${noteName}#^${ref.id}|${ref.text}]]`
		: `[[${noteName}#^${ref.id}]]`;
}
