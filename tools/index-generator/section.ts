import { IndexGeneratorError } from "./errors.ts";
import type { IndexEntry } from "./notes.ts";

export const INDEX_MD = "index.md";
export const BEGIN_MARKER = "<!-- BEGIN GENERATED -->";
export const END_MARKER = "<!-- END GENERATED -->";

/**
 * One flat line per note (#25): wikilink by basename, sorted tags, created
 * date. A note with no tags drops the tag segment rather than leaving an
 * empty one.
 */
export function renderLine(entry: IndexEntry): string {
	const tags = entry.tags.map((tag) => `#${tag}`).join(" ");
	return tags === ""
		? `- [[${entry.name}]] — ${entry.created}`
		: `- [[${entry.name}]] — ${tags} — ${entry.created}`;
}

/**
 * The generated section, markers included; the `## All notes` heading lives
 * inside the fences. Fully deterministic: no timestamps, no counts — a
 * no-change sync renders byte-identical output.
 */
export function renderSection(entries: IndexEntry[]): string {
	const lines = [
		BEGIN_MARKER,
		"",
		"## All notes",
		"",
		...entries.map(renderLine),
		"",
		END_MARKER,
	];
	return lines.join("\n");
}

/**
 * Splices the generated section into existing index.md content. Everything
 * outside the markers is preserved byte-for-byte; a file without markers
 * gets the section appended (self-healing); unbalanced markers are an
 * error, never a clobber.
 */
export function spliceIndexMd(existing: string, section: string): string {
	const text = existing.replace(/\r\n/g, "\n");
	const begin = text.indexOf(BEGIN_MARKER);
	const end = text.indexOf(END_MARKER);
	if (begin === -1 && end === -1) {
		const separator = text.endsWith("\n") ? "\n" : "\n\n";
		return `${text}${separator}${section}\n`;
	}
	if (begin === -1 || end === -1 || end < begin) {
		throw new IndexGeneratorError(
			`${INDEX_MD} has unbalanced generated-section markers — fix or remove the markers by hand`,
		);
	}
	const before = text.slice(0, begin);
	const after = text.slice(end + END_MARKER.length);
	const beforeNorm =
		before === "" || before.endsWith("\n") ? before : `${before}\n`;
	const afterNorm =
		after === "" || after.startsWith("\n") ? after : `\n${after}`;
	return `${beforeNorm}${section}${afterNorm}`;
}
