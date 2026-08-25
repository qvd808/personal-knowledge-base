import { ResourceHarvesterError } from "./errors.ts";

export const RESOURCES_MD = "resources.md";
export const BEGIN_MARKER = "<!-- BEGIN GENERATED -->";
export const END_MARKER = "<!-- END GENERATED -->";

/** Code-unit order: byte-order for ASCII, identical on every platform. */
export function compareCodeUnits(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export interface ResourceEntry {
	/** `res-` + 8 hex chars of the URL hash (#37). */
	id: string;
	/** The trimmed verbatim URL — the Resource's identity. */
	url: string;
	/** Original link text; alphabetically-first note wins on conflict (#38). */
	title: string;
	/** Union of the contributing notes' frontmatter tags. */
	tags: Set<string>;
}

/**
 * The generated section of `resources.md` (#38 §5): one `## <tag>` Topic
 * section per tag, alphabetical, entries `- [title](<URL>)` sorted by title
 * and unique by URL; then the `## References` registry — one
 * `- <URL> ^res-xxxxxxxx` line per Resource, sorted by URL, the sole target
 * of resource wikilinks. Fully deterministic: no timestamps, no counts.
 */
export function renderSection(entries: ResourceEntry[]): string {
	const byTag = new Map<string, ResourceEntry[]>();
	for (const entry of entries) {
		for (const tag of entry.tags) {
			const bucket = byTag.get(tag);
			if (bucket) {
				bucket.push(entry);
			} else {
				byTag.set(tag, [entry]);
			}
		}
	}

	const lines: string[] = [BEGIN_MARKER, ""];
	for (const tag of [...byTag.keys()].sort(compareCodeUnits)) {
		const bucket = byTag.get(tag) ?? [];
		bucket.sort(
			(a, b) =>
				compareCodeUnits(a.title, b.title) || compareCodeUnits(a.url, b.url),
		);
		lines.push(`## ${tag}`, "");
		for (const entry of bucket) {
			lines.push(`- [${entry.title}](${entry.url})`);
		}
		lines.push("");
	}

	const references = entries
		.slice()
		.sort((a, b) => compareCodeUnits(a.url, b.url));
	lines.push("## References", "");
	for (const entry of references) {
		lines.push(`- ${entry.url} ^${entry.id}`);
	}
	lines.push("", END_MARKER);
	return lines.join("\n");
}

/**
 * Splices the generated section into existing resources.md content — the
 * index-generator contract: everything outside the markers is preserved
 * byte-for-byte; missing markers self-heal by appending; unbalanced markers
 * are an error, never a clobber.
 */
export function spliceResourcesMd(existing: string, section: string): string {
	const text = existing.replace(/\r\n/g, "\n");
	const begin = text.indexOf(BEGIN_MARKER);
	const end = text.indexOf(END_MARKER);
	if (begin === -1 && end === -1) {
		const separator = text.endsWith("\n") ? "\n" : "\n\n";
		return `${text}${separator}${section}\n`;
	}
	if (begin === -1 || end === -1 || end < begin) {
		throw new ResourceHarvesterError(
			`${RESOURCES_MD} has unbalanced generated-section markers — fix or remove the markers by hand`,
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

const REGISTRY_LINE = /^- (https?:\/\/\S+) \^(res-[0-9a-f]{8})\s*$/;

/**
 * Parses the current id↔URL registry from the References lines of existing
 * resources.md content — the only memory of Resources whose raw URL has
 * vanished from note bodies.
 */
export function parseRegistry(existing: string): Map<string, string> {
	const registry = new Map<string, string>();
	for (const line of existing.replace(/\r\n/g, "\n").split("\n")) {
		const match = REGISTRY_LINE.exec(line);
		if (!match) continue;
		const url = match[1];
		const id = match[2];
		if (url !== undefined && id !== undefined) {
			registry.set(id, url);
		}
	}
	return registry;
}
