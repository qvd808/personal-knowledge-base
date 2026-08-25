import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { checkableFlags, type Finding, findSwaps, maskLine } from "./check.ts";
import { addedLines, changedNotes } from "./diff.ts";
import { ChangeReviewError } from "./errors.ts";
import { parseWordlist } from "./wordlist.ts";

export interface ReviewResult {
	ok: boolean;
	findings: Finding[];
	/** How many changed notes were examined. */
	changedNotes: number;
	error?: string;
}

const WORDLIST_FILE = "wordlist.txt";

function loadWordlist(moduleDir: string) {
	const file = path.join(moduleDir, WORDLIST_FILE);
	let text: string;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ChangeReviewError(`couldn't read ${WORDLIST_FILE}: ${message}`);
	}
	const parsed = parseWordlist(text);
	if (parsed.errors.length > 0) {
		throw new ChangeReviewError(parsed.errors.join("; "));
	}
	return parsed.wordlist;
}

/**
 * The diff-gated change review (#40): added lines of every changed note are
 * masked to prose and checked against the wordlist's swap pairs. Findings
 * are data — the step always succeeds when it completes; only infrastructure
 * failures (git, unreadable files, malformed wordlist) are errors.
 */
export function run(repoRoot: string, vaultDir = "knowledge"): ReviewResult {
	try {
		const moduleDir = path.dirname(fileURLToPath(import.meta.url));
		const wordlist = loadWordlist(moduleDir);

		const changed = changedNotes(repoRoot, vaultDir);
		const findings: Finding[] = [];
		for (const relativePath of changed) {
			const repoPath = `${vaultDir}/${relativePath}`;
			const lines = addedLines(repoRoot, repoPath);
			if (lines.length === 0) continue;
			const worktree = path.join(repoRoot, repoPath);
			const flags = checkableFlags(
				fs.readFileSync(worktree, "utf8").split(/\r?\n/),
			);
			for (const { line, text } of lines) {
				if (flags[line - 1] !== true) continue;
				findings.push(
					...findSwaps(relativePath, line, maskLine(text), wordlist),
				);
			}
		}
		return { ok: true, findings, changedNotes: changed.length };
	} catch (error) {
		if (error instanceof ChangeReviewError) {
			return { ok: false, findings: [], changedNotes: 0, error: error.message };
		}
		throw error;
	}
}

export function formatFinding(vaultDir: string, finding: Finding): string {
	return `${vaultDir}/${finding.file}:${finding.line} [swap] '${finding.wrong}' -> '${finding.right}'`;
}

function main(argv: string[]): void {
	const flags = argv.filter((arg) => arg.startsWith("-"));
	const positional = argv.filter((arg) => !arg.startsWith("-"));
	if (flags.length > 0 || positional.length > 1) {
		console.error("usage: tsx tools/change-review/review.ts [repo-root]");
		process.exitCode = 2;
		return;
	}
	const repoRoot = positional[0] ?? ".";
	const result = run(repoRoot);
	if (!result.ok) {
		console.error(`change-review: ${result.error ?? "failed"}`);
		process.exitCode = 1;
		return;
	}
	for (const finding of result.findings) {
		console.log(formatFinding("knowledge", finding));
	}
	const count = result.findings.length;
	console.log(
		count === 0
			? `change-review: no findings in ${result.changedNotes} changed note(s)`
			: `change-review: ${count} finding(s)`,
	);
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
