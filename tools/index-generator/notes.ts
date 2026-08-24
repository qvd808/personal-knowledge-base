import fs from "node:fs";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { EXCALIDRAW_DIR, IMAGES_DIR, scanVault } from "../lib/vault.ts";
import { IndexGeneratorError } from "./errors.ts";

export interface IndexEntry {
	/** Wikilink stem: the note's basename without `.md`. */
	name: string;
	/** The note's tags, sorted alphabetically (code-unit order). */
	tags: string[];
	/** The note's `created` date, verbatim from frontmatter. */
	created: string;
	/** Vault-relative POSIX path (sort tiebreak and diagnostics). */
	relativePath: string;
}

/**
 * The #25 exclusion list, explicit and extensible: the index itself,
 * anything image-like or non-note in nature, and templates. scanVault
 * already keeps images/, Excalidraw/ and dot-paths out of `notes`; they are
 * named here anyway so this list tells the whole story. `draft: true` is
 * per-note and checked from frontmatter in collectEntries.
 */
const EXCLUDED_DIRS = new Set([IMAGES_DIR, EXCALIDRAW_DIR, "templates"]);
const EXCLUDED_FILES = new Set(["index.md"]);

function topDirOf(relativePath: string): string | undefined {
	const slash = relativePath.indexOf("/");
	return slash === -1 ? undefined : relativePath.slice(0, slash);
}

export function isExcluded(relativePath: string): boolean {
	if (EXCLUDED_FILES.has(relativePath)) return true;
	const topDir = topDirOf(relativePath);
	return topDir !== undefined && EXCLUDED_DIRS.has(topDir);
}

/** Code-unit order: byte-order for ASCII, identical on every platform. */
export function compareCodeUnits(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function baseName(relativePath: string): string {
	const name = relativePath.slice(relativePath.lastIndexOf("/") + 1);
	return name.replace(/\.md$/i, "");
}

/**
 * Reads every listable note in the vault at `root` into a sorted entry list.
 * Notes without usable `tags`/`created` frontmatter are an error, not a
 * silent omission — vault-lint owns the schema and runs first at sync time,
 * so a failure here means lint was skipped.
 */
export function collectEntries(root: string): IndexEntry[] {
	const entries: IndexEntry[] = [];
	for (const note of scanVault(root).notes) {
		if (isExcluded(note.relativePath)) continue;
		const source = fs.readFileSync(note.absolutePath, "utf8");
		const parsed = parseFrontmatter(source, note.relativePath);
		if (parsed === null) {
			throw new IndexGeneratorError(
				`${note.relativePath}: missing frontmatter — every listed note needs "tags" and "created"`,
			);
		}
		const { fields } = parsed;
		if (fields.draft === true) continue;

		const tags = fields.tags;
		if (
			!Array.isArray(tags) ||
			!tags.every((tag): tag is string => typeof tag === "string")
		) {
			throw new IndexGeneratorError(
				`${note.relativePath}: "tags" must be a list of strings (may be empty)`,
			);
		}
		const created = fields.created;
		if (typeof created !== "string" || created === "") {
			throw new IndexGeneratorError(
				`${note.relativePath}: "created" must be a date (YYYY-MM-DD)`,
			);
		}

		entries.push({
			name: baseName(note.relativePath),
			tags: tags.slice().sort(compareCodeUnits),
			created,
			relativePath: note.relativePath,
		});
	}
	entries.sort(
		(a, b) =>
			compareCodeUnits(a.name, b.name) ||
			compareCodeUnits(a.relativePath, b.relativePath),
	);
	return entries;
}
