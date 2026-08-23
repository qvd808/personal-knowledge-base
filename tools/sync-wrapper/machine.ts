import type { Config } from "./config.ts";

/**
 * The sync wrapper as a pure state machine (#18): `decide` picks the next
 * effect from the current state, `apply` folds the effect's observation back
 * in. No I/O happens here — the thin shell in sync.ts executes effects.
 */

/** The sync-time steps the wrapper spawns, in fixed order. */
export type StepName = "glue" | "lint" | "index";

export type Phase =
	| "launch"
	| "await-exit"
	| "verify-exit"
	| "verify-wait"
	| "preflight"
	| "unlock-check"
	| "unlock-wait"
	| "unlock-remove"
	| "glue"
	| "glue-diff"
	| "lint"
	| "index"
	| "prompt"
	| "stage"
	| "staged-list"
	| "commit"
	| "pull"
	| "pull-failed"
	| "push"
	| "notify"
	| "done";

/** In-progress git state, detected the way `git status` does (research §3). */
export interface GitState {
	mergeHead: boolean;
	rebaseMerge: boolean;
	rebaseApply: boolean;
	indexLock: boolean;
}

export interface ExitInfo {
	code: number | null;
	signal: NodeJS.Signals | null;
	/** Set when the child errored (e.g. spawn failure) instead of exiting. */
	error?: string;
}

export interface RunResult {
	code: number | null;
	stdout: string;
	stderr: string;
	/** Set on spawn-level failure (binary missing, etc.). */
	error?: string;
}

export interface Failure {
	/** One-line gist — goes in the modal dialog. */
	summary: string;
	/** Full detail — goes to the console. */
	detail: string;
	/** Dialog icon: warning for benign (offline-shaped), error for real. */
	severity: "warning" | "error";
	/** Wrapper exit code once the notification is dismissed. */
	exitCode: number;
}

export interface State {
	config: Config;
	phase: Phase;
	exit?: ExitInfo;
	gitState?: GitState;
	lockWaitMs: number;
	staged: string[];
	pullFailure?: RunResult;
	failure?: Failure;
	haltCode?: number;
	haltMessage?: string;
}

export type Effect =
	| { kind: "launch"; command: string; args: string[] }
	| { kind: "await-exit" }
	| { kind: "check-process"; image: string }
	| { kind: "sleep"; ms: number }
	| { kind: "read-git-state" }
	| { kind: "remove-lock" }
	| { kind: "run-step"; step: StepName }
	| { kind: "check-glue-diff" }
	| { kind: "prompt"; title: string; message: string }
	| { kind: "git"; label: string; args: string[] }
	| {
			kind: "notify";
			severity: "warning" | "error";
			title: string;
			message: string;
			detail: string;
	  };

export type Observation =
	| { kind: "launched" }
	| { kind: "exited"; exit: ExitInfo }
	| { kind: "process-status"; image: string; running: boolean | null }
	| { kind: "slept" }
	| { kind: "git-state"; gitState: GitState }
	| { kind: "lock-removed" }
	| { kind: "step-done"; step: StepName; result: RunResult }
	| { kind: "glue-diff"; result: RunResult }
	| { kind: "prompt-done"; result: RunResult }
	| { kind: "git-done"; label: string; result: RunResult }
	| { kind: "notified" };

export function initialState(config: Config): State {
	return { config, phase: "launch", lockWaitMs: 0, staged: [] };
}

/** Picks the next effect for the current phase; "halt" ends the wrapper. */
export function decide(state: State): Effect | "halt" {
	const { config } = state;
	switch (state.phase) {
		case "launch":
			return {
				kind: "launch",
				command: config.obsidianExe,
				args: [`obsidian://open?vault=${encodeURIComponent(config.vaultName)}`],
			};
		case "await-exit":
			return { kind: "await-exit" };
		case "verify-exit":
			return { kind: "check-process", image: "Obsidian.exe" };
		case "verify-wait":
		case "unlock-wait":
			return { kind: "sleep", ms: config.pollIntervalMs };
		case "preflight":
		case "pull-failed":
			return { kind: "read-git-state" };
		case "unlock-check":
			return { kind: "check-process", image: "git.exe" };
		case "unlock-remove":
			return { kind: "remove-lock" };
		case "glue":
			return { kind: "run-step", step: "glue" };
		case "glue-diff":
			return { kind: "check-glue-diff" };
		case "lint":
			return { kind: "run-step", step: "lint" };
		case "index":
			return { kind: "run-step", step: "index" };
		case "prompt":
			return {
				kind: "prompt",
				title: "Obsidian sync",
				message: "Sync notes to GitHub?",
			};
		case "stage":
			return { kind: "git", label: "add", args: ["add", "-A"] };
		case "staged-list":
			return {
				kind: "git",
				label: "staged-list",
				args: ["diff", "--cached", "--name-only"],
			};
		case "commit":
			return {
				kind: "git",
				label: "commit",
				args: [
					"commit",
					"-m",
					commitMessage(config.today, state.staged.length),
				],
			};
		case "pull":
			return { kind: "git", label: "pull", args: ["pull", "--rebase"] };
		case "push":
			return { kind: "git", label: "push", args: ["push"] };
		case "notify": {
			const failure = state.failure;
			if (!failure) return "halt"; // unreachable: notify only follows fail()
			return {
				kind: "notify",
				severity: failure.severity,
				title: "Obsidian sync",
				message: failure.summary,
				detail: failure.detail,
			};
		}
		case "done":
			return "halt";
	}
}

/** Folds one observation into the state, advancing the phase. */
export function apply(state: State, obs: Observation): void {
	switch (obs.kind) {
		case "launched":
			state.phase = "await-exit";
			return;
		case "exited":
			state.exit = obs.exit;
			if (obs.exit.error !== undefined) {
				fail(
					state,
					"Couldn't launch Obsidian",
					`Spawning ${state.config.obsidianExe} failed: ${obs.exit.error}\n` +
						"Check obsidianExe in tools/sync-wrapper/config.local.json.",
					1,
				);
				return;
			}
			state.phase = "verify-exit";
			return;
		case "process-status":
			if (obs.running === null) {
				fail(
					state,
					"Couldn't verify running processes",
					`tasklist failed while checking for ${obs.image}; ` +
						"refusing to continue blind.",
					1,
				);
				return;
			}
			if (state.phase === "verify-exit") {
				// 'exit' is only a hint: Electron single-instance handoff and
				// updater relaunches leave another Obsidian.exe alive (research §1).
				state.phase = obs.running ? "verify-wait" : "preflight";
			} else if (state.phase === "unlock-check") {
				state.phase = obs.running ? "unlock-wait" : "unlock-remove";
			}
			return;
		case "slept":
			if (state.phase === "verify-wait") {
				state.phase = "verify-exit";
			} else if (state.phase === "unlock-wait") {
				state.lockWaitMs += state.config.pollIntervalMs;
				if (state.lockWaitMs >= state.config.lockWaitTimeoutMs) {
					fail(
						state,
						"Another git process is still running",
						`Waited ${state.lockWaitMs}ms for git.exe to finish while ` +
							".git/index.lock exists. Let it finish (or kill it), then sync again.",
						1,
					);
					return;
				}
				state.phase = "unlock-check";
			}
			return;
		case "git-state":
			state.gitState = obs.gitState;
			if (state.phase === "preflight") {
				const s = obs.gitState;
				if (s.mergeHead || s.rebaseMerge || s.rebaseApply) {
					fail(
						state,
						"A merge or rebase is already in progress",
						"In-progress git state found under .git (MERGE_HEAD, " +
							"rebase-merge/, or rebase-apply/). Finish or abort it by hand, " +
							"then run sync again.",
						1,
					);
					return;
				}
				state.phase = s.indexLock ? "unlock-check" : "glue";
			} else if (state.phase === "pull-failed") {
				classifyPullFailure(state, obs.gitState);
			}
			return;
		case "lock-removed":
			if (state.gitState) state.gitState.indexLock = false;
			state.phase = "glue";
			return;
		case "step-done":
			if (obs.result.error !== undefined || obs.result.code !== 0) {
				fail(state, `${stepLabel(obs.step)} failed`, detailOf(obs.result), 1);
				return;
			}
			if (obs.step === "glue") state.phase = "glue-diff";
			else if (obs.step === "lint") state.phase = "index";
			else state.phase = "prompt";
			return;
		case "glue-diff":
			if (obs.result.error !== undefined || obs.result.code !== 0) {
				fail(state, "Couldn't verify skill glue", detailOf(obs.result), 1);
				return;
			}
			if (obs.result.stdout.trim() !== "") {
				fail(
					state,
					"Skill glue is out of sync",
					"Regenerating the glue changed tracked files:\n" +
						`${obs.result.stdout.trim()}\n` +
						"Run `npm run glue`, review the changes, and commit them " +
						"before syncing.",
					1,
				);
				return;
			}
			state.phase = "lint";
			return;
		case "prompt-done": {
			if (obs.result.error !== undefined || obs.result.code !== 0) {
				fail(state, "Couldn't show the sync prompt", detailOf(obs.result), 1);
				return;
			}
			const answer = parsePromptAnswer(obs.result.stdout);
			if (answer === "yes") {
				state.phase = "stage";
				return;
			}
			// "no" or unparsable: never commit on ambiguity.
			state.phase = "done";
			state.haltCode = 0;
			state.haltMessage = "Nothing committed — changes stay local.";
			return;
		}
		case "git-done": {
			const { label, result } = obs;
			const failed = result.error !== undefined || result.code !== 0;
			switch (label) {
				case "add":
					if (failed) {
						fail(state, "git add failed", detailOf(result), 1);
						return;
					}
					state.phase = "staged-list";
					return;
				case "staged-list":
					if (failed) {
						fail(state, "Couldn't inspect staged changes", detailOf(result), 1);
						return;
					}
					state.staged = result.stdout
						.split("\n")
						.map((line) => line.trim())
						.filter((line) => line !== "");
					// obsidian-git may have left local commits; push even when the
					// tree is clean.
					state.phase = state.staged.length === 0 ? "pull" : "commit";
					return;
				case "commit":
					if (failed) {
						fail(state, "git commit failed", detailOf(result), 1);
						return;
					}
					state.phase = "pull";
					return;
				case "pull":
					if (!failed) {
						state.phase = "push";
						return;
					}
					state.pullFailure = result;
					state.phase = "pull-failed";
					return;
				case "push":
					if (!failed) {
						state.phase = "done";
						state.haltCode = 0;
						state.haltMessage = "Sync complete.";
						return;
					}
					if (isOfflineShaped(result.stderr + result.stdout)) {
						fail(
							state,
							"Offline — changes stayed local",
							"git push failed with a connection-shaped error. The commit " +
								"is local and will go out on the next sync.\n\n" +
								detailOf(result),
							0,
							"warning",
						);
					} else {
						fail(
							state,
							"Push failed — the commit is safe locally",
							`${detailOf(result)}\n\n` +
								"Likely rejected or auth. Fix by hand (or sign in again); " +
								"the next sync retries the push.",
							0,
							"error",
						);
					}
					return;
			}
			return;
		}
		case "notified": {
			const failure = state.failure;
			state.phase = "done";
			state.haltCode = failure?.exitCode ?? 1;
			return;
		}
	}
}

/**
 * A failed `pull --rebase` either stopped on a conflict (rebase state now
 * exists in .git — never auto-`--continue`), failed to reach the remote
 * (offline-shaped: benign, the commit stays local), or failed for real.
 */
function classifyPullFailure(state: State, gitState: GitState): void {
	const result = state.pullFailure;
	const detail = result ? detailOf(result) : "unknown failure";
	if (gitState.rebaseMerge || gitState.rebaseApply) {
		fail(
			state,
			"Rebase stopped on a conflict",
			"git pull --rebase could not apply your commit cleanly. Resolve " +
				"by hand (git rebase --continue or git rebase --abort) — the " +
				`wrapper never auto-continues.\n\n${detail}`,
			1,
		);
		return;
	}
	if (result && isOfflineShaped(result.stderr + result.stdout)) {
		fail(
			state,
			"Offline — changes stayed local",
			"git pull --rebase failed with a connection-shaped error. The " +
				`commit is local and will go out on the next sync.\n\n${detail}`,
			0,
			"warning",
		);
		return;
	}
	fail(state, "git pull --rebase failed", detail, 1);
}

/**
 * Connection-shaped stderr only. Auth/rejected failures ("Authentication
 * failed", "Permission denied", "non-fast-forward") must NOT match — they
 * get the real-failure wording.
 */
const OFFLINE_PATTERNS = [
	/could not resolve host/i,
	/temporary failure in name resolution/i,
	/failed to connect/i,
	/connection (refused|reset|timed out|aborted)/i,
	/timed out/i,
	/network is unreachable/i,
	/no route to host/i,
	/ssh: connect to host/i,
];

export function isOfflineShaped(output: string): boolean {
	return OFFLINE_PATTERNS.some((pattern) => pattern.test(output));
}

export function parsePromptAnswer(stdout: string): "yes" | "no" | null {
	const answer = stdout.trim().toLowerCase();
	if (answer === "yes") return "yes";
	if (answer === "no") return "no";
	return null;
}

export function commitMessage(today: string, filesChanged: number): string {
	const noun = filesChanged === 1 ? "file" : "files";
	return `sync(${today}): ${filesChanged} ${noun} changed`;
}

function fail(
	state: State,
	summary: string,
	detail: string,
	exitCode: number,
	severity: "warning" | "error" = "error",
): void {
	state.failure = { summary, detail, severity, exitCode };
	state.phase = "notify";
}

function stepLabel(step: StepName): string {
	if (step === "glue") return "Skill glue";
	if (step === "lint") return "Vault lint";
	return "Index generator";
}

function detailOf(result: RunResult): string {
	const parts: string[] = [];
	if (result.error !== undefined) parts.push(result.error);
	if (result.stderr.trim() !== "") parts.push(result.stderr.trim());
	if (result.stdout.trim() !== "") parts.push(result.stdout.trim());
	if (parts.length === 0) parts.push(`exit code ${result.code ?? "unknown"}`);
	return parts.join("\n");
}
