import fs from "node:fs";
import path from "node:path";
import { AGENTS_MD, type GluePlan } from "./plan.ts";
import { GLUE_DIR } from "./store.ts";

export interface Change {
	action: "write" | "delete";
	/** Repo-relative POSIX path. */
	path: string;
}

function listFilesRecursive(dir: string, base: string, out: string[]): void {
	const entries = fs
		.readdirSync(dir, { withFileTypes: true })
		.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			listFilesRecursive(full, base, out);
		} else if (entry.isFile()) {
			out.push(path.relative(base, full).split(path.sep).join("/"));
		}
	}
}

function removeEmptyDirs(dir: string, root: string): void {
	if (!fs.existsSync(dir) || path.resolve(dir) === path.resolve(root)) return;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			removeEmptyDirs(path.join(dir, entry.name), root);
		}
	}
	if (fs.readdirSync(dir).length === 0) {
		fs.rmdirSync(dir);
	}
}

/**
 * Diffs the plan against disk and, unless `check` is set, applies it. Returns
 * the list of changes needed (or made). Deletions are scoped to files inside
 * `.claude/skills/<name>/` for skills currently in the store — anything else
 * under `.claude/` is never touched.
 */
export function reconcile(
	root: string,
	plan: GluePlan,
	check: boolean,
): Change[] {
	const changes: Change[] = [];

	for (const name of plan.skillDirs) {
		const dir = path.join(root, GLUE_DIR, name);
		if (!fs.existsSync(dir)) continue;
		const actual: string[] = [];
		listFilesRecursive(dir, dir, actual);
		for (const relative of actual) {
			const desired = `${GLUE_DIR}/${name}/${relative}`;
			if (!plan.skillFiles.has(desired)) {
				changes.push({ action: "delete", path: desired });
				if (!check) {
					fs.rmSync(path.join(root, desired));
					removeEmptyDirs(path.dirname(path.join(root, desired)), dir);
				}
			}
		}
	}

	for (const [relative, content] of plan.skillFiles) {
		const absolute = path.join(root, relative);
		if (fs.existsSync(absolute) && fs.readFileSync(absolute).equals(content))
			continue;
		changes.push({ action: "write", path: relative });
		if (!check) {
			fs.mkdirSync(path.dirname(absolute), { recursive: true });
			fs.writeFileSync(absolute, content);
		}
	}

	const agentsAbsolute = path.join(root, AGENTS_MD);
	const currentAgents = fs.existsSync(agentsAbsolute)
		? fs.readFileSync(agentsAbsolute, "utf8").replace(/\r\n/g, "\n")
		: null;
	if (currentAgents !== plan.agentsMd) {
		changes.push({ action: "write", path: AGENTS_MD });
		if (!check) {
			fs.writeFileSync(agentsAbsolute, plan.agentsMd);
		}
	}

	return changes;
}
