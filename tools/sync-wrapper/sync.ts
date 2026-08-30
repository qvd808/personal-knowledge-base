import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { SyncWrapperError } from "./errors.ts";
import {
	apply,
	decide,
	type Effect,
	type GitState,
	initialState,
	type Observation,
	type State,
} from "./machine.ts";
import {
	gitEnv,
	type LaunchHandle,
	messageBoxArgs,
	parseTasklist,
	realShell,
	type Shell,
	STEP_ARGS,
	STEP_SCRIPTS,
	tasklistArgs,
} from "./shell.ts";

/** Glue paths whose post-regeneration diff aborts the sync (#10/#15). */
const GLUE_PATHS = [".claude/skills/", "AGENTS.md"];

/**
 * The thin effectful shell (#18): loops `decide` → execute → `apply` until
 * the machine halts. All spawning goes through the injected `shell`; the
 * only direct I/O here is fs state detection under `.git` and console output.
 */
export async function runWrapper(
	state: State,
	shell: Shell,
	log: (message: string) => void = console.log,
): Promise<State> {
	let launched: LaunchHandle | undefined;

	async function execute(effect: Effect): Promise<Observation> {
		const { config } = state;
		switch (effect.kind) {
			case "launch":
				log(`sync: launching Obsidian (vault "${config.vaultName}")`);
				launched = shell.launch(effect.command, effect.args);
				return { kind: "launched" };
			case "await-exit": {
				log("sync: waiting for Obsidian to close");
				if (!launched) {
					return {
						kind: "exited",
						exit: {
							code: null,
							signal: null,
							error: "launch handle missing",
						},
					};
				}
				return { kind: "exited", exit: await launched.exited };
			}
			case "check-process": {
				const result = await shell.run("tasklist", tasklistArgs(effect.image), {
					cwd: config.repoRoot,
				});
				if (result.error !== undefined || result.code !== 0) {
					return {
						kind: "process-status",
						image: effect.image,
						running: null,
					};
				}
				return {
					kind: "process-status",
					image: effect.image,
					running: parseTasklist(result.stdout, effect.image),
				};
			}
			case "sleep":
				await shell.sleep(effect.ms);
				return { kind: "slept" };
			case "read-git-state":
				return {
					kind: "git-state",
					gitState: readGitState(config.repoRoot),
				};
			case "remove-lock":
				log("sync: removing stale .git/index.lock (no git.exe running)");
				fs.rmSync(path.join(config.repoRoot, ".git", "index.lock"), {
					force: true,
				});
				return { kind: "lock-removed" };
			case "run-step": {
				const script = STEP_SCRIPTS[effect.step];
				const extra = STEP_ARGS[effect.step] ?? [];
				log(`sync: running ${[script, ...extra].join(" ")}`);
				const result = await shell.run(
					process.execPath,
					["--import", "tsx", script, ...extra],
					{ cwd: config.repoRoot },
				);
				return { kind: "step-done", step: effect.step, result };
			}
			case "check-glue-diff": {
				const result = await shell.run(
					"git",
					["status", "--porcelain", "--", ...GLUE_PATHS],
					{ cwd: config.repoRoot, env: gitEnv() },
				);
				return { kind: "glue-diff", result };
			}
			case "prompt": {
				const result = await shell.run(
					"powershell.exe",
					messageBoxArgs(effect.message, effect.title, "YesNo", "Question"),
				);
				return { kind: "prompt-done", result };
			}
			case "git": {
				log(`sync: git ${effect.args.join(" ")}`);
				const result = await shell.run("git", effect.args, {
					cwd: config.repoRoot,
					env: gitEnv(),
				});
				return { kind: "git-done", label: effect.label, result };
			}
			case "notify": {
				log(`sync: ${effect.message}`);
				if (effect.detail !== "") log(effect.detail);
				// Best-effort: the dialog must never crash the wrapper.
				await shell.run(
					"powershell.exe",
					messageBoxArgs(
						effect.message,
						effect.title,
						"OK",
						effect.severity === "error" ? "Error" : "Warning",
					),
				);
				return { kind: "notified" };
			}
		}
	}

	let effect = decide(state);
	while (effect !== "halt") {
		apply(state, await execute(effect));
		effect = decide(state);
	}
	return state;
}

export function readGitState(repoRoot: string): GitState {
	const gitDir = path.join(repoRoot, ".git");
	return {
		mergeHead: fs.existsSync(path.join(gitDir, "MERGE_HEAD")),
		rebaseMerge: fs.existsSync(path.join(gitDir, "rebase-merge")),
		rebaseApply: fs.existsSync(path.join(gitDir, "rebase-apply")),
		indexLock: fs.existsSync(path.join(gitDir, "index.lock")),
	};
}

async function main(): Promise<void> {
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	try {
		const config = loadConfig(moduleDir, process.env);
		const state = await runWrapper(initialState(config), realShell);
		if (state.haltMessage !== undefined) {
			console.log(`sync: ${state.haltMessage}`);
		}
		process.exitCode = state.haltCode ?? 0;
	} catch (error) {
		if (error instanceof SyncWrapperError) {
			console.error(`sync: ${error.message}`);
			process.exitCode = 2;
			return;
		}
		console.error(error);
		const message = error instanceof Error ? error.message : String(error);
		await realShell
			.run(
				"powershell.exe",
				messageBoxArgs(
					`Sync wrapper crashed: ${message}`,
					"Obsidian sync",
					"OK",
					"Error",
				),
			)
			.catch(() => {});
		process.exitCode = 1;
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
	main();
}
