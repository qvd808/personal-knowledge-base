import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { type Change, reconcile } from "./apply.ts";
import { SkillGlueError } from "./errors.ts";
import { AGENTS_MD, buildPlan } from "./plan.ts";
import { readStore } from "./store.ts";

export interface RunResult {
	ok: boolean;
	check: boolean;
	changes: Change[];
	error?: string;
}

/**
 * Generates (or, with `check`, verifies) all skill glue for the repo at
 * `root`. Expected failures come back as `ok: false` with a message; the
 * caller decides the exit code. Nothing outside `.claude/skills/<store skill>/`
 * and the fenced AGENTS.md section is ever written.
 */
export function run(
	root: string,
	options: { check?: boolean } = {},
): RunResult {
	const check = options.check ?? false;
	try {
		const skills = readStore(root);
		const agentsAbsolute = path.join(root, AGENTS_MD);
		const existingAgents = fs.existsSync(agentsAbsolute)
			? fs.readFileSync(agentsAbsolute, "utf8")
			: null;
		const plan = buildPlan(skills, existingAgents);
		const changes = reconcile(root, plan, check);
		if (check && changes.length > 0) {
			return {
				ok: false,
				check,
				changes,
				error: `glue is out of sync (${changes.length} change(s) needed) — run \`npm run glue\` and commit the result`,
			};
		}
		return { ok: true, check, changes };
	} catch (error) {
		if (error instanceof SkillGlueError) {
			return { ok: false, check, changes: [], error: error.message };
		}
		throw error;
	}
}

function main(argv: string[]): void {
	const unknown = argv.filter((arg) => arg !== "--check");
	if (unknown.length > 0) {
		console.error(`skill-glue: unknown argument(s): ${unknown.join(", ")}`);
		console.error("usage: tsx tools/skill-glue/generate.ts [--check]");
		process.exitCode = 2;
		return;
	}
	const check = argv.includes("--check");
	const result = run(process.cwd(), { check });
	for (const change of result.changes) {
		console.log(`${change.action} ${change.path}`);
	}
	if (!result.ok) {
		console.error(`skill-glue: ${result.error ?? "failed"}`);
		process.exitCode = 1;
		return;
	}
	if (result.changes.length === 0) {
		console.log("skill-glue: glue is up to date");
	} else {
		console.log(`skill-glue: ${result.changes.length} file(s) regenerated`);
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
