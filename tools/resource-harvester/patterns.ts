/**
 * The v1 Pattern registry (#38 §2), first match wins, applied to
 * Resources-section lines only:
 *
 * 1. Inline `[text](https://…)` — target must be an absolute http(s) URL.
 * 2. Reference usage `[text][label]` whose definition `[label]: <URL>`
 *    appears later in the same section.
 *
 * A line already carrying a resource wikilink feeds the membership scan and
 * is never re-rewritten. Non-matching lines pass through untouched — never
 * an error (input quality belongs to vault-lint's findings tier).
 */

export const RESOURCE_WIKILINK =
	/\[\[resources#\^(res-[0-9a-f]{8})(?:\|([^\]]*))?\]\]/g;

const INLINE_LINK = /\[([^[\]]*)\]\((https?:\/\/[^\s()]+)\)/g;

const REF_USAGE = /\[([^[\]]+)\]\[([^[\]]+)\]/g;

/** `[label]: <https://…>` or `[label]: https://…` — a definition, not a usage. */
export const REF_DEFINITION =
	/^\s*\[([^\]]+)\]:\s*(?:<(https?:\/\/[^\s>]+)>|(https?:\/\/\S+))\s*$/;

export interface Definition {
	/** Lowercased label — reference labels match case-insensitively. */
	label: string;
	url: string;
}

export interface LineScan {
	/** Sustained resource ids found on this line (already-rewritten links). */
	sustainedIds: string[];
	/** Alias text per sustained id, when present. */
	aliases: Map<string, string>;
	/** URLs matched by Patterns on this line, with their original link text. */
	matchedUrls: { url: string; title: string }[];
	/** Labels whose definition was used for a rewrite on this line. */
	usedLabels: string[];
	/** The line after rewriting; identical to the input when nothing matched. */
	rewritten: string;
}

/** A line whose entire content is one resource wikilink, carrying no bullet. */
const BARE_RESOURCE_LINK =
	/^\s*\[\[resources#\^res-[0-9a-f]{8}(?:\|[^\]]*)?\]\]\s*$/;

/**
 * Prefixes a bare resource wikilink with `- `, so a Resources section always
 * renders as a list.
 *
 * Two adjacent link lines with no bullets are one paragraph in CommonMark, so
 * Quartz joins them onto a single line while Obsidian, which breaks on every
 * newline by default, shows them stacked. A list renders the same in both.
 *
 * Only a line that is *entirely* one wikilink is touched. Prose that happens
 * to mention a resource keeps its shape, as does anything already bulleted.
 */
export function bulletiseResourceLink(line: string): string {
	return BARE_RESOURCE_LINK.test(line) ? `- ${line.trim()}` : line;
}

export function isDefinition(line: string): boolean {
	return REF_DEFINITION.test(line);
}

export function parseDefinition(line: string): Definition | undefined {
	const match = REF_DEFINITION.exec(line);
	if (!match) return undefined;
	const label = match[1];
	const url = match[2] ?? match[3];
	if (label === undefined || url === undefined) return undefined;
	return { label: label.toLowerCase(), url };
}

function restore(input: string, rewritten: string): string {
	return rewritten === input ? input : rewritten;
}

/**
 * Scans one Resources-section line: records already-rewritten wikilinks,
 * rewrites inline links and reference usages whose definition resolves.
 */
export function scanLine(
	line: string,
	definitions: Map<string, Definition>,
): LineScan {
	const scan: LineScan = {
		sustainedIds: [],
		aliases: new Map(),
		matchedUrls: [],
		usedLabels: [],
		rewritten: line,
	};

	for (const match of line.matchAll(RESOURCE_WIKILINK)) {
		const id = match[1];
		const alias = match[2];
		if (id === undefined) continue;
		scan.sustainedIds.push(id);
		if (alias !== undefined && alias !== "") {
			scan.aliases.set(id, alias);
		}
	}

	let rewritten = scan.rewritten;
	for (const match of rewritten.matchAll(INLINE_LINK)) {
		const full = match[0];
		const text = match[1] ?? "";
		const url = match[2] ?? "";
		rewritten = rewritten.replace(
			full,
			`[[resources#^${resourceIdFor(url)}|${text}]]`,
		);
		scan.matchedUrls.push({ url, title: text });
	}

	for (const match of rewritten.matchAll(REF_USAGE)) {
		const full = match[0];
		const text = match[1] ?? "";
		const label = (match[2] ?? "").toLowerCase();
		const definition = definitions.get(label);
		if (!definition) continue;
		rewritten = rewritten.replace(
			full,
			`[[resources#^${resourceIdFor(definition.url)}|${text}]]`,
		);
		scan.matchedUrls.push({ url: definition.url, title: text });
		scan.usedLabels.push(label);
	}

	scan.rewritten = restore(line, rewritten);
	return scan;
}

// Imported late to avoid a cycle in docs above; ids.ts has no imports.
import { resourceId as resourceIdFor } from "./ids.ts";
