import type { Vault } from "./vault.ts";

export interface Wikilink {
	target: string;
	embed: boolean;
	/** 1-based line number in the source file. */
	line: number;
}

const WIKILINK = /(!?)\[\[([^\][|#]+?)(?:#[^\][|]*)?(?:\|[^\][]*)?\]\]/g;

/**
 * Pulls every `[[target]]` / `![[target]]` out of note source, stripping
 * `#heading` and `|alias` suffixes. Targets are Obsidian-style: note names
 * or attachment filenames, resolved vault-wide.
 */
export function extractWikilinks(source: string): Wikilink[] {
	const links: Wikilink[] = [];
	for (const match of source.matchAll(WIKILINK)) {
		const target = match[2]?.trim();
		if (!target) continue;
		const line = source.slice(0, match.index).split("\n").length;
		links.push({ target, embed: match[1] === "!", line });
	}
	return links;
}

export interface LinkIndex {
	resolve(target: string): boolean;
}

function baseName(posixPath: string): string {
	return posixPath.slice(posixPath.lastIndexOf("/") + 1);
}

/**
 * Obsidian resolution semantics: a bare target matches any note or
 * attachment by basename, vault-wide; a target with a `/` is a vault-relative
 * path. Notes match with or without the `.md`; attachments match by full
 * filename, or by stem as a fallback for extension-less embeds.
 */
export function buildLinkIndex(vault: Vault): LinkIndex {
	const noteStems = new Set<string>();
	const notePaths = new Set<string>();
	for (const file of [...vault.notes, ...vault.drawings]) {
		const withoutExt = file.relativePath.replace(/\.md$/i, "");
		notePaths.add(withoutExt);
		noteStems.add(baseName(withoutExt));
	}
	const attachmentNames = new Set<string>();
	const attachmentStems = new Set<string>();
	const attachmentPaths = new Set<string>();
	for (const file of vault.attachments) {
		attachmentPaths.add(file.relativePath);
		const name = baseName(file.relativePath);
		attachmentNames.add(name);
		attachmentStems.add(name.replace(/\.[^.]+$/, ""));
	}
	return {
		resolve(rawTarget: string): boolean {
			const target = rawTarget.trim();
			if (target === "") return true;
			if (target.includes("/")) {
				return (
					notePaths.has(target.replace(/\.md$/i, "")) ||
					attachmentPaths.has(target)
				);
			}
			if (/\.md$/i.test(target)) {
				return noteStems.has(target.replace(/\.md$/i, ""));
			}
			if (/\.[a-z0-9]+$/i.test(target)) {
				return attachmentNames.has(target);
			}
			return noteStems.has(target) || attachmentStems.has(target);
		},
	};
}
