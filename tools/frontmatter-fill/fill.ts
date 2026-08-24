import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
	FrontmatterError,
	parseFrontmatter,
	type YamlValue,
} from "../lib/frontmatter.ts";
import { scanVault } from "../lib/vault.ts";
import { FrontmatterFillError } from "./errors.ts";

export interface FillResult {
	/** Vault-relative paths written this run. */
	filled: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatDateFromMtime(mtimeMs: number): string {
	const date = new Date(mtimeMs);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function noteStem(relativePath: string): string {
	return path.basename(relativePath, path.extname(relativePath));
}

function defaultTags(stem: string): string[] {
	return [stem];
}

function needsTags(tags: YamlValue | undefined): boolean {
	return tags === undefined || !Array.isArray(tags);
}

function needsCreated(created: YamlValue | undefined): boolean {
	return typeof created !== "string" || !DATE.test(created);
}

/** Minimal YAML emitter for the vault note schema (#7). */
export function renderFrontmatter(fields: Record<string, YamlValue>): string {
	const lines = ["---"];
	const tags = fields.tags;
	if (Array.isArray(tags)) {
		lines.push("tags:");
		for (const tag of tags) {
			if (typeof tag === "string") lines.push(`  - ${tag}`);
		}
	}
	const created = fields.created;
	if (typeof created === "string") {
		lines.push(`created: ${created}`);
	}
	for (const [key, value] of Object.entries(fields)) {
		if (key === "tags" || key === "created") continue;
		if (typeof value === "string") {
			lines.push(`${key}: ${value}`);
		} else if (typeof value === "boolean") {
			lines.push(`${key}: ${value}`);
		} else if (value === null) {
			lines.push(`${key}: null`);
		}
	}
	lines.push("---", "");
	return `${lines.join("\n")}\n`;
}

/**
 * Prepends or patches frontmatter on notes missing required fields. Tags
 * default to the note stem; created defaults to the file's mtime (local date).
 * Invalid frontmatter is left for vault-lint to flag.
 */
export function fillFrontmatter(vaultRoot: string): FillResult {
	if (!fs.existsSync(vaultRoot) || !fs.statSync(vaultRoot).isDirectory()) {
		throw new FrontmatterFillError(`vault not found at ${vaultRoot}`);
	}
	const filled: string[] = [];
	const vault = scanVault(vaultRoot);
	for (const note of vault.notes) {
		const source = fs.readFileSync(note.absolutePath, "utf8");
		let parsed: ReturnType<typeof parseFrontmatter>;
		try {
			parsed = parseFrontmatter(source, note.relativePath);
		} catch (error) {
			if (error instanceof FrontmatterError) continue;
			throw error;
		}
		const stat = fs.statSync(note.absolutePath);
		const stem = noteStem(note.relativePath);
		const defaults = {
			tags: defaultTags(stem),
			created: formatDateFromMtime(stat.mtimeMs),
		};
		if (parsed === null) {
			fs.writeFileSync(
				note.absolutePath,
				renderFrontmatter(defaults) + source.replace(/^\uFEFF?/, ""),
			);
			filled.push(note.relativePath);
			continue;
		}
		const fields = { ...parsed.fields };
		let changed = false;
		if (needsTags(fields.tags)) {
			fields.tags = defaults.tags;
			changed = true;
		}
		if (needsCreated(fields.created)) {
			fields.created = defaults.created;
			changed = true;
		}
		if (!changed) continue;
		fs.writeFileSync(note.absolutePath, renderFrontmatter(fields) + parsed.body);
		filled.push(note.relativePath);
	}
	return { filled };
}

function main(argv: string[]): void {
	const flags = argv.filter((arg) => arg.startsWith("-"));
	const positional = argv.filter((arg) => !arg.startsWith("-"));
	if (flags.length > 0 || positional.length > 1) {
		console.error("usage: tsx tools/frontmatter-fill/fill.ts [vault-root]");
		process.exitCode = 2;
		return;
	}
	const vaultRoot = positional[0] ?? "knowledge";
	try {
		const { filled } = fillFrontmatter(vaultRoot);
		if (filled.length === 0) {
			console.log("frontmatter-fill: nothing to fill");
			return;
		}
		for (const file of filled) {
			console.log(`${vaultRoot}/${file}`);
		}
		console.log(`frontmatter-fill: ${filled.length} note(s) updated`);
	} catch (error) {
		if (error instanceof FrontmatterFillError) {
			console.error(`frontmatter-fill: ${error.message}`);
			process.exitCode = 1;
			return;
		}
		throw error;
	}
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
