import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { scanVault } from "../lib/vault.ts";
import { VaultLintError } from "./errors.ts";
import {
	checkBlockAnchors,
	checkBlockAnchorTargets,
	checkFrontmatter,
	checkKebabCase,
	checkSecrets,
	checkWikilinks,
	type Finding,
	type Violation,
} from "./rules.ts";

export interface LintResult {
	ok: boolean;
	violations: Violation[];
	/** Report-only observations; they never affect `ok`. */
	findings: Finding[];
	error?: string;
}

function byPlace<T extends { file: string; rule: string; line?: number }>(
	a: T,
	b: T,
): number {
	return (
		a.file.localeCompare(b.file) ||
		(a.line ?? 0) - (b.line ?? 0) ||
		a.rule.localeCompare(b.rule)
	);
}

/**
 * Runs every rule against the vault at `vaultRoot`. Expected failures
 * (missing vault) come back as `ok: false` with a message; violations are
 * data. The caller decides the exit code. Findings ride alongside: they are
 * reported but never fail the sync, so only violations move `ok`.
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
			...checkBlockAnchors(vault),
		].sort(byPlace);
		const findings = [...checkBlockAnchorTargets(vault)].sort(byPlace);
		return { ok: violations.length === 0, violations, findings };
	} catch (error) {
		if (error instanceof VaultLintError) {
			return { ok: false, violations: [], findings: [], error: error.message };
		}
		throw error;
	}
}

export function formatViolation(
	vaultRoot: string,
	v: Violation | Finding,
): string {
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
	for (const f of result.findings) {
		console.log(formatViolation(vaultRoot, f));
	}
	if (result.findings.length > 0) {
		console.log(`vault-lint: ${result.findings.length} finding(s)`);
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
