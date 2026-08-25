import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { FrontmatterError, parseFrontmatter } from "../lib/frontmatter.ts";
import { scanVault } from "../lib/vault.ts";
import { ResourceHarvesterError } from "./errors.ts";
import { resourceId } from "./ids.ts";
import {
	type Definition,
	isDefinition,
	parseDefinition,
	scanLine,
} from "./patterns.ts";
import {
	compareCodeUnits,
	parseRegistry,
	RESOURCES_MD,
	type ResourceEntry,
	renderSection,
	spliceResourcesMd,
} from "./render.ts";

export interface HarvestResult {
	ok: boolean;
	/** True when any note body or resources.md was rewritten. */
	changed: boolean;
	/** The number of distinct Resources now in the registry. */
	resources: number;
	error?: string;
}

const GENERATED_FILES = new Set(["index.md", RESOURCES_MD]);

interface NoteInfo {
	/** Basename without `.md` — the alphabetically-first-note tiebreak. */
	name: string;
	tags: string[];
}

/**
 * `[start, end)` line ranges of `## Resources` sections: a line exactly
 * `## Resources` (trimmed) opens one; the next heading of level ≤ 2 closes
 * it. `###` subheadings inside remain part of the section (#38 §1).
 */
export function findResourceSections(lines: string[]): Array<[number, number]> {
	const sections: Array<[number, number]> = [];
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (start === -1) {
			if (line.trim() === "## Resources") start = i + 1;
		} else if (/^#{1,2}\s/.test(line)) {
			sections.push([start, i]);
			start = line.trim() === "## Resources" ? i + 1 : -1;
		}
	}
	if (start !== -1) sections.push([start, lines.length]);
	return sections;
}

/** Membership accumulators across the whole vault (#38 §4). */
class Membership {
	private readonly urlTitles = new Map<
		string,
		{ title: string; note: string }
	>();
	private readonly urlNotes = new Map<string, Set<string>>();
	private readonly idAliases = new Map<
		string,
		{ alias: string; note: string }
	>();
	private readonly idNotes = new Map<string, Set<string>>();
	private readonly notes = new Map<string, NoteInfo>();

	note(relativePath: string, info: NoteInfo): void {
		this.notes.set(relativePath, info);
	}

	addUrl(url: string, title: string, relativePath: string): void {
		this.touch(this.urlNotes, url, relativePath);
		const existing = this.urlTitles.get(url);
		const claim = { title, note: relativePath };
		if (!existing || compareCodeUnits(relativePath, existing.note) < 0) {
			this.urlTitles.set(url, claim);
		}
	}

	addSustained(id: string, alias: string, relativePath: string): void {
		this.touch(this.idNotes, id, relativePath);
		const existing = this.idAliases.get(id);
		const claim = { alias, note: relativePath };
		if (!existing || compareCodeUnits(relativePath, existing.note) < 0) {
			this.idAliases.set(id, claim);
		}
	}

	urls(): IterableIterator<string> {
		return this.urlTitles.keys();
	}

	sustainedIds(): IterableIterator<string> {
		return this.idAliases.keys();
	}

	titleFor(url: string, id: string): string {
		const claimed = this.urlTitles.get(url);
		if (claimed) return claimed.title;
		const sustained = this.idAliases.get(id);
		if (sustained) return sustained.alias;
		return url;
	}

	tagsFor(url: string, id: string): Set<string> {
		const tags = new Set<string>();
		for (const key of this.urlNotes.get(url) ?? []) {
			for (const tag of this.notes.get(key)?.tags ?? []) tags.add(tag);
		}
		for (const key of this.idNotes.get(id) ?? []) {
			for (const tag of this.notes.get(key)?.tags ?? []) tags.add(tag);
		}
		return tags;
	}

	private touch(
		map: Map<string, Set<string>>,
		key: string,
		relativePath: string,
	): void {
		const set = map.get(key);
		if (set) {
			set.add(relativePath);
		} else {
			map.set(key, new Set([relativePath]));
		}
	}
}

interface SectionScan {
	lines: string[];
	changed: boolean;
	urls: { url: string; title: string }[];
	sustained: { id: string; alias: string }[];
}

function processSection(
	sectionLines: string[],
	definitions: Map<string, Definition>,
): SectionScan {
	const definitionLines = new Map<number, Definition>();
	sectionLines.forEach((line, offset) => {
		if (!isDefinition(line)) return;
		const definition = parseDefinition(line);
		if (definition) {
			definitionLines.set(offset, definition);
			definitions.set(definition.label, definition);
		}
	});

	const usedLabels = new Set<string>();
	const urls: { url: string; title: string }[] = [];
	const sustained: { id: string; alias: string }[] = [];
	const output = sectionLines.map((line, offset) => {
		if (definitionLines.has(offset)) return line;
		const scan = scanLine(line, definitions);
		urls.push(...scan.matchedUrls);
		for (const id of scan.sustainedIds) {
			sustained.push({ id, alias: scan.aliases.get(id) ?? "" });
		}
		for (const label of scan.usedLabels) usedLabels.add(label);
		return scan.rewritten;
	});

	const kept = output
		.map((line, offset) => ({ line, offset }))
		.filter(({ offset }) => {
			const definition = definitionLines.get(offset);
			return !(definition !== undefined && usedLabels.has(definition.label));
		})
		.map(({ line }) => line);

	const changed =
		kept.length !== sectionLines.length ||
		kept.some((line, index) => line !== sectionLines[index]);

	return { lines: kept, changed, urls, sustained };
}

function noteTags(source: string, relativePath: string): string[] {
	const parsed = parseFrontmatter(source, relativePath);
	if (parsed === null) return [];
	const tags = parsed.fields.tags;
	if (
		!Array.isArray(tags) ||
		!tags.every((tag): tag is string => typeof tag === "string")
	) {
		return [];
	}
	return tags;
}

/**
 * The sync-time harvest (#38): every note's `## Resources` sections are
 * pattern-matched, links rewritten to resource wikilinks, reference
 * definitions consumed, and `resources.md` regenerated — topic views plus
 * the anchored References registry, the sole id↔URL memory. Mutations stay
 * inside Resources sections; everything outside any section is untouched.
 * Expected failures come back as `ok: false`; the caller decides exit code.
 */
export function run(vaultRoot: string): HarvestResult {
	try {
		if (!fs.existsSync(vaultRoot) || !fs.statSync(vaultRoot).isDirectory()) {
			throw new ResourceHarvesterError(`vault not found at ${vaultRoot}`);
		}

		const membership = new Membership();
		let notesChanged = false;

		const notes = scanVault(vaultRoot).notes.filter((note) => {
			const base = note.relativePath.slice(
				note.relativePath.lastIndexOf("/") + 1,
			);
			return !GENERATED_FILES.has(base);
		});

		for (const note of notes) {
			const source = fs.readFileSync(note.absolutePath, "utf8");
			membership.note(note.relativePath, {
				name: note.relativePath.slice(note.relativePath.lastIndexOf("/") + 1),
				tags: noteTags(source, note.relativePath),
			});

			const eol = source.includes("\r\n") ? "\r\n" : "\n";
			const originalLines = source.split(/\r?\n/);
			const sections = findResourceSections(originalLines);
			if (sections.length === 0) continue;

			const definitions = new Map<string, Definition>();
			const working = [...originalLines];
			let noteChanged = false;
			for (let s = sections.length - 1; s >= 0; s--) {
				const [start, end] = sections[s] ?? [0, 0];
				const scanned = processSection(
					originalLines.slice(start, end),
					definitions,
				);
				working.splice(start, end - start, ...scanned.lines);
				for (const { url, title } of scanned.urls) {
					membership.addUrl(url, title, note.relativePath);
				}
				for (const { id, alias } of scanned.sustained) {
					membership.addSustained(id, alias, note.relativePath);
				}
				if (scanned.changed) noteChanged = true;
			}

			if (noteChanged) {
				fs.writeFileSync(note.absolutePath, working.join(eol));
				notesChanged = true;
			}
		}

		const resourcesPath = path.join(vaultRoot, RESOURCES_MD);
		const existing = fs.existsSync(resourcesPath)
			? fs.readFileSync(resourcesPath, "utf8")
			: "";

		const entries = assemble(membership, existing);
		const next = spliceResourcesMd(existing, renderSection(entries));
		const resourcesChanged = next !== existing;
		if (resourcesChanged) {
			fs.writeFileSync(resourcesPath, next);
		}

		return {
			ok: true,
			changed: notesChanged || resourcesChanged,
			resources: entries.length,
		};
	} catch (error) {
		if (
			error instanceof ResourceHarvesterError ||
			error instanceof FrontmatterError
		) {
			return { ok: false, changed: false, resources: 0, error: error.message };
		}
		throw error;
	}
}

function assemble(
	membership: Membership,
	existingResourcesMd: string,
): ResourceEntry[] {
	const registry = parseRegistry(existingResourcesMd);
	for (const id of membership.sustainedIds()) {
		if (!registry.has(id)) {
			throw new ResourceHarvesterError(
				`note sustains ${id} but that id is absent from the ${RESOURCES_MD} registry — restore the registry line or fix the wikilink`,
			);
		}
	}

	const byUrl = new Map<string, ResourceEntry>();
	const ensure = (url: string): ResourceEntry => {
		const found = byUrl.get(url);
		if (found) return found;
		const id = resourceId(url);
		const entry: ResourceEntry = {
			id,
			url,
			title: membership.titleFor(url, id),
			tags: new Set(),
		};
		byUrl.set(url, entry);
		return entry;
	};

	for (const url of membership.urls()) ensure(url);
	for (const id of membership.sustainedIds()) {
		const url = registry.get(id);
		if (url !== undefined) ensure(url);
	}
	for (const entry of byUrl.values()) {
		entry.tags = membership.tagsFor(entry.url, entry.id);
	}

	checkCollisions([...byUrl.values()]);
	return [...byUrl.values()];
}

function checkCollisions(entries: ResourceEntry[]): void {
	const seen = new Map<string, string>();
	for (const entry of entries) {
		const clash = seen.get(entry.id);
		if (clash !== undefined && clash !== entry.url) {
			throw new ResourceHarvesterError(
				`SHA-256 id collision: "${clash}" and "${entry.url}" both hash to ${entry.id}`,
			);
		}
		seen.set(entry.id, entry.url);
	}
}

function main(argv: string[]): void {
	const flags = argv.filter((arg) => arg.startsWith("-"));
	const positional = argv.filter((arg) => !arg.startsWith("-"));
	if (flags.length > 0 || positional.length > 1) {
		console.error(
			"usage: tsx tools/resource-harvester/harvest.ts [vault-root]",
		);
		process.exitCode = 2;
		return;
	}
	const vaultRoot = positional[0] ?? "knowledge";
	const result = run(vaultRoot);
	if (!result.ok) {
		console.error(`harvest: ${result.error ?? "failed"}`);
		process.exitCode = 1;
		return;
	}
	const target = `${vaultRoot.replace(/[\\/]+$/, "")}/${RESOURCES_MD}`;
	const verb = result.changed ? "regenerated" : "up to date";
	console.log(`harvest: ${target} ${verb} (${result.resources} resource(s))`);
}

const invokedAsScript = (() => {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
})();

if (invokedAsScript) {
	main(process.argv.slice(2));
}
