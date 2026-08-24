import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { FrontmatterError } from "../lib/frontmatter.ts";
import { IndexGeneratorError } from "./errors.ts";
import { collectEntries, type IndexEntry } from "./notes.ts";
import { INDEX_MD, renderSection, spliceIndexMd } from "./section.ts";

export interface RunResult {
	ok: boolean;
	/** True when index.md was rewritten; false on a byte-identical re-run. */
	changed: boolean;
	/** The entries now listed in the generated section. */
	entries: IndexEntry[];
	error?: string;
}

/**
 * Regenerates the delimited section of `<vaultRoot>/index.md` (#25): flat
 * alphabetical note list between the markers, everything else untouched.
 * Expected failures come back as `ok: false` with a message; the caller
 * decides the exit code.
 */
export function run(vaultRoot: string): RunResult {
	try {
		if (!fs.existsSync(vaultRoot) || !fs.statSync(vaultRoot).isDirectory()) {
			throw new IndexGeneratorError(`vault not found at ${vaultRoot}`);
		}
		const indexPath = path.join(vaultRoot, INDEX_MD);
		if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) {
			throw new IndexGeneratorError(
				`${vaultRoot.replace(/[\\/]+$/, "")}/${INDEX_MD} not found`,
			);
		}
		const entries = collectEntries(vaultRoot);
		const existing = fs.readFileSync(indexPath, "utf8");
		const next = spliceIndexMd(existing, renderSection(entries));
		const changed = next !== existing;
		if (changed) {
			fs.writeFileSync(indexPath, next);
		}
		return { ok: true, changed, entries };
	} catch (error) {
		if (
			error instanceof IndexGeneratorError ||
			error instanceof FrontmatterError
		) {
			return { ok: false, changed: false, entries: [], error: error.message };
		}
		throw error;
	}
}

function main(argv: string[]): void {
	const flags = argv.filter((arg) => arg.startsWith("-"));
	const positional = argv.filter((arg) => !arg.startsWith("-"));
	if (flags.length > 0 || positional.length > 1) {
		console.error("usage: tsx tools/index-generator/generate.ts [vault-root]");
		process.exitCode = 2;
		return;
	}
	const vaultRoot = positional[0] ?? "knowledge";
	const result = run(vaultRoot);
	if (!result.ok) {
		console.error(`index: ${result.error ?? "failed"}`);
		process.exitCode = 1;
		return;
	}
	const indexPath = `${vaultRoot.replace(/[\\/]+$/, "")}/${INDEX_MD}`;
	if (result.changed) {
		console.log(
			`index: regenerated ${indexPath} (${result.entries.length} note(s))`,
		);
	} else {
		console.log(
			`index: ${indexPath} is up to date (${result.entries.length} note(s))`,
		);
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
