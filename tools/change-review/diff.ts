import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ChangeReviewError } from "./errors.ts";

/**
 * Change detection (#40 §1–2): the changed set is tracked notes under the
 * vault that differ from `HEAD` plus untracked note files; for each, only
 * the **added lines** are extracted from `git diff -U0` hunk headers.
 * Untouched lines are never re-reported.
 */

export interface AddedLine {
	/** 1-based line number in the worktree file. */
	line: number;
	text: string;
}

interface GitOptions {
	allowFailure?: boolean;
}

function git(
	repoRoot: string,
	args: string[],
	options: GitOptions = {},
): string {
	try {
		return execFileSync("git", args, {
			cwd: repoRoot,
			encoding: "utf8",
			windowsHide: true,
		});
	} catch (error) {
		if (options.allowFailure) return "";
		const message = error instanceof Error ? error.message : String(error);
		throw new ChangeReviewError(`git ${args[0]} failed: ${message}`);
	}
}

export function isNotePath(relativePath: string): boolean {
	const base = relativePath.slice(relativePath.lastIndexOf("/") + 1);
	if (base === "index.md" || base === "resources.md") return false;
	if (!base.toLowerCase().endsWith(".md")) return false;
	const topDir = relativePath.includes("/")
		? relativePath.slice(0, relativePath.indexOf("/"))
		: undefined;
	return (
		topDir === undefined ||
		(topDir !== "images" && topDir !== "Excalidraw" && topDir !== "templates")
	);
}

/**
 * Tracked-changed ∪ untracked note paths — vault-relative POSIX, sorted.
 */
export function changedNotes(repoRoot: string, vaultDir: string): string[] {
	const scope = `${vaultDir}/`;
	const tracked = git(repoRoot, ["diff", "--name-only", "HEAD", "--", scope]);
	const untracked = git(repoRoot, [
		"ls-files",
		"--others",
		"--exclude-standard",
		"--",
		scope,
	]);
	const changed = new Set<string>();
	for (const list of [tracked, untracked]) {
		for (const line of list.split("\n")) {
			const repoPath = line.trim();
			if (repoPath === "" || !repoPath.startsWith(scope)) continue;
			const vaultPath = repoPath.slice(scope.length);
			if (isNotePath(vaultPath)) changed.add(vaultPath);
		}
	}
	return [...changed].sort();
}

function inHead(repoRoot: string, relativePath: string): boolean {
	try {
		execFileSync("git", ["cat-file", "-e", `HEAD:${relativePath}`], {
			cwd: repoRoot,
			stdio: "ignore",
			windowsHide: true,
		});
		return true;
	} catch {
		return false;
	}
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * The added lines of one changed file. Untracked files (absent from HEAD)
 * contribute every line; tracked files contribute exactly what `-U0` hunks
 * mark as added on the new-file side — pure deletions add nothing.
 */
export function addedLines(
	repoRoot: string,
	relativePath: string,
): AddedLine[] {
	const worktree = path.join(repoRoot, relativePath);
	let source: string;
	try {
		source = fs.readFileSync(worktree, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ChangeReviewError(`couldn't read ${relativePath}: ${message}`);
	}
	const worktreeLines = source.split(/\r?\n/);

	if (!inHead(repoRoot, relativePath)) {
		return worktreeLines.map((text, index) => ({ line: index + 1, text }));
	}

	const diff = git(repoRoot, ["diff", "-U0", "HEAD", "--", relativePath]);
	const added: AddedLine[] = [];
	let newLine = 0;
	let remaining = 0;
	for (const line of diff.replace(/\r\n/g, "\n").split("\n")) {
		const header = HUNK_HEADER.exec(line);
		if (header) {
			newLine = Number(header[1]);
			remaining = header[2] === undefined ? 1 : Number(header[2]);
			continue;
		}
		if (remaining === 0) continue;
		if (line.startsWith("+") && !line.startsWith("+++")) {
			added.push({
				line: newLine,
				text: worktreeLines[newLine - 1] ?? line.slice(1),
			});
			newLine++;
			remaining--;
		} else if (line.startsWith("\\") || line.startsWith("-")) {
		} else {
			// No context under -U0; consume defensively against flag changes.
			newLine++;
			remaining--;
		}
	}
	return added;
}
