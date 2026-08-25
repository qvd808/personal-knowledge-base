import type { Wordlist } from "./wordlist.ts";

/**
 * Prose-only checking (#40 §5): check what readers see, never touch what
 * machines address. Frontmatter and fenced code are file-level regions;
 * inline code spans, URLs, image/link syntax, wikilink targets/ids and
 * trailing block ids are masked per line. Everything left is prose —
 * headings, paragraphs, list items, table cells, alias text.
 */

export interface Finding {
	/** Vault-relative POSIX path. */
	file: string;
	line: number;
	wrong: string;
	right: string;
}

const INLINE_SPAN = /`[^`]*`/g;
const URL = /https?:\/\/\S+/g;
const IMAGE_EMBED = /!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g;
const WIKILINK = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g;
const BLOCK_ID = /\s\^[A-Za-z0-9-]+\s*$/;
const FENCE = /^(```|~~~)/;

function mask(match: string): string {
	return " ".repeat(match.length);
}

/** Blanks every non-prose region of one body line, preserving offsets. */
export function maskLine(line: string): string {
	let masked = line.replace(INLINE_SPAN, mask);
	masked = masked.replace(URL, mask);
	masked = masked.replace(IMAGE_EMBED, mask);
	masked = masked.replace(WIKILINK, (full, _target: string, alias?: string) =>
		alias !== undefined && alias !== "" ? ` ${alias} ` : mask(full),
	);
	return masked.replace(BLOCK_ID, mask);
}

const WORD = /[A-Za-z][A-Za-z'-]*/g;

/** Whole-word swap detection over already-masked prose. */
export function findSwaps(
	file: string,
	line: number,
	masked: string,
	wordlist: Wordlist,
): Finding[] {
	const findings: Finding[] = [];
	for (const match of masked.matchAll(WORD)) {
		const word = match[0];
		const right = wordlist.swaps.get(word.toLowerCase());
		if (right === undefined) continue;
		findings.push({ file, line, wrong: word, right });
	}
	return findings;
}

/**
 * Which lines are checkable prose: frontmatter (leading `---` block) and
 * fenced code regions are not — including the fence lines themselves.
 * Returned per input line index.
 */
export function checkableFlags(lines: string[]): boolean[] {
	const flags: boolean[] = [];
	let inFrontmatter = lines[0]?.trimEnd() === "---";
	let inFence = false;
	for (const [index, raw] of lines.entries()) {
		const line = raw.trimEnd();
		if (inFrontmatter) {
			flags.push(false);
			if (index > 0 && line === "---") inFrontmatter = false;
			continue;
		}
		if (FENCE.test(line.trim())) {
			flags.push(false);
			inFence = !inFence;
			continue;
		}
		flags.push(!inFence);
	}
	return flags;
}
