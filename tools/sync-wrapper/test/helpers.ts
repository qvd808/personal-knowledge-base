import process from "node:process";
import type { Config } from "../config.ts";
import {
	type ExitInfo,
	initialState,
	type RunResult,
	type State,
} from "../machine.ts";
import {
	type LaunchHandle,
	type RunOptions,
	type Shell,
	STEP_SCRIPTS,
} from "../shell.ts";
import { runWrapper } from "../sync.ts";

export {
	cleanup,
	exists,
	makeTmpRoot,
	writeFile,
} from "../../lib/test/helpers.ts";

export interface RecordedRun {
	command: string;
	args: string[];
	cwd?: string;
	/** GIT_* / GCM_* entries of the spawn env, when one was passed. */
	env?: Record<string, string | undefined>;
}

/**
 * Scripts spawn results instead of executing them; every wrapper spawn
 * (Obsidian, tasklist, powershell, git, the tsx steps) lands here.
 */
export class FakeShell implements Shell {
	runs: RecordedRun[] = [];
	launches: { command: string; args: string[] }[] = [];
	sleeps: number[] = [];
	exitInfo: ExitInfo = { code: 0, signal: null };
	handler: (command: string, args: string[]) => RunResult = () => ok();

	launch(command: string, args: string[]): LaunchHandle {
		this.launches.push({ command, args });
		return { exited: Promise.resolve(this.exitInfo) };
	}

	run(
		command: string,
		args: string[],
		options?: RunOptions,
	): Promise<RunResult> {
		const recorded: RecordedRun = { command, args };
		if (options?.cwd !== undefined) recorded.cwd = options.cwd;
		if (options?.env !== undefined) {
			const env: Record<string, string | undefined> = {};
			for (const [key, value] of Object.entries(options.env)) {
				if (key.startsWith("GIT_") || key.startsWith("GCM_")) {
					env[key] = value;
				}
			}
			recorded.env = env;
		}
		this.runs.push(recorded);
		return Promise.resolve(this.handler(command, args));
	}

	sleep(ms: number): Promise<void> {
		this.sleeps.push(ms);
		return Promise.resolve();
	}
}

export function ok(extra: Partial<RunResult> = {}): RunResult {
	return { code: 0, stdout: "", stderr: "", ...extra };
}

export function fail(code: number, stderr: string): RunResult {
	return { code, stdout: "", stderr };
}

export const NO_TASKS =
	"INFO: No tasks are running which match the specified criteria.\r\n";

export function tasksRunning(image: string): string {
	return `"${image}","1234","Console","1","100,000 K"\r\n`;
}

export function testConfig(
	repoRoot: string,
	overrides: Partial<Config> = {},
): Config {
	return {
		obsidianExe: "C:\\fake\\Obsidian.exe",
		vaultName: "knowledge",
		repoRoot,
		today: "2026-08-23",
		pollIntervalMs: 1000,
		lockWaitTimeoutMs: 2500,
		...overrides,
	};
}

/**
 * Baseline scripting for a clean run: no processes alive, prompt answers
 * Yes, two staged files, everything exits 0. Tests override what they need.
 */
export function baseHandler(
	override?: (command: string, args: string[]) => RunResult | undefined,
): (command: string, args: string[]) => RunResult {
	return (command, args) => {
		const custom = override?.(command, args);
		if (custom !== undefined) return custom;
		if (command === "tasklist") return ok({ stdout: NO_TASKS });
		if (command === "powershell.exe") return ok({ stdout: "Yes\r\n" });
		if (command === "git" && args[0] === "diff") {
			return ok({ stdout: "knowledge/a.md\nknowledge/tools.md\n" });
		}
		return ok();
	};
}

export async function runFake(
	fake: FakeShell,
	root: string,
	overrides: Partial<Config> = {},
): Promise<State> {
	const state = initialState(testConfig(root, overrides));
	await runWrapper(state, fake, () => {});
	return state;
}

/** One tag per spawned process, for ordering assertions. */
export function timeline(fake: FakeShell): string[] {
	return fake.runs.map((run) => {
		if (run.command === "tasklist") {
			const filter = run.args[1] ?? "";
			return `tasklist:${filter.replace("IMAGENAME eq ", "")}`;
		}
		if (run.command === "powershell.exe") {
			return run.args.some((arg) => arg.includes("'YesNo'"))
				? "prompt"
				: "notify";
		}
		if (run.command === "git") return `git:${run.args.join(" ")}`;
		if (run.command === process.execPath) {
			const script = run.args[2] ?? "";
			const step = Object.entries(STEP_SCRIPTS).find(
				([, path]) => path === script,
			);
			return `step:${step?.[0] ?? script}`;
		}
		return run.command;
	});
}

/** The PowerShell `-Command` strings of every notification dialog shown. */
export function notifications(fake: FakeShell): string[] {
	return fake.runs
		.filter((run) => run.command === "powershell.exe")
		.map((run) => run.args[run.args.length - 1] ?? "")
		.filter((command) => command.includes("'OK'"));
}
