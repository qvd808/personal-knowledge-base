import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { VaultLintError } from "./errors.ts";
import {
	checkFrontmatter,
	checkKebabCase,
	checkSecrets,
	checkWikilinks,
	type Violation,
} from "./rules.ts";
import { scanVault } from "./vault.ts";

export interface LintResult {
	ok: boolean;
	violations: Violation[];
	error?: string;
}

/**
 * Runs every rule against the vault at `vaultRoot`. Expected failures
 * (missing vault) come back as `ok: false` with a message; violations are
 * data. The caller decides the exit code.
 */
export function run(vaultRoot: string): LintResult {
	try {
		if (!fs.existsSync(vaultRoot) || !fs.statSync(vaultRoot).isDirectory()) {
			throw new VaultLintError(`vault not found at ${vaultRoot}`);
		}
		const vault = scanVault(vaultRoot);
		const violations = [
			...checkFrontmatter(vault),
			...checkKebabCase(vault),
			...checkWikilinks(vault),
			...checkSecrets(vault),
		].sort(
			(a, b) =>
				a.file.localeCompare(b.file) ||
				(a.line ?? 0) - (b.line ?? 0) ||
				a.rule.localeCompare(b.rule),
		);
		return { ok: violations.length === 0, violations };
	} catch (error) {
		if (error instanceof VaultLintError) {
			return { ok: false, violations: [], error: error.message };
		}
		throw error;
	}
}

export function formatViolation(vaultRoot: string, v: Violation): string {
	const root = vaultRoot.replace(/[\\/]+$/, "");
	const where = v.line !== undefined ? `${v.file}:${v.line}` : v.file;
	return `${root}/${where} [${v.rule}] ${v.message}`;
}

function main(argv: string[]): void {
	const flags = argv.filter((arg) => arg.startsWith("-"));
	const positional = argv.filter((arg) => !arg.startsWith("-"));
	if (flags.length > 0 || positional.length > 1) {
		console.error("usage: tsx tools/vault-lint/lint.ts [vault-root]");
		process.exitCode = 2;
		return;
	}
	const vaultRoot = positional[0] ?? "knowledge";
	const result = run(vaultRoot);
	for (const v of result.violations) {
		console.log(formatViolation(vaultRoot, v));
	}
	if (result.error !== undefined) {
		console.error(`vault-lint: ${result.error}`);
		process.exitCode = 1;
		return;
	}
	if (!result.ok) {
		console.error(`vault-lint: ${result.violations.length} violation(s)`);
		process.exitCode = 1;
		return;
	}
	console.log("vault-lint: no violations");
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
