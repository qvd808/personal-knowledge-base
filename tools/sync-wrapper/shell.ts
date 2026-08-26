import { type SpawnOptions, spawn } from "node:child_process";
import process from "node:process";
import type { ExitInfo, RunResult, StepName } from "./machine.ts";

/**
 * The injected seam (#18): every process spawn, process check, and sleep in
 * the wrapper goes through this interface, so unit tests run on Linux with
 * fakes and never touch real Windows binaries.
 */

export interface LaunchHandle {
	/** Resolves on the first of 'exit' / 'error' (research §1: handle both). */
	exited: Promise<ExitInfo>;
}

export interface RunOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
}

export interface Shell {
	/** Fire-and-wait spawn for the long-lived GUI process. */
	launch(command: string, args: string[]): LaunchHandle;
	/** Spawn to completion, capturing stdout/stderr. */
	run(
		command: string,
		args: string[],
		options?: RunOptions,
	): Promise<RunResult>;
	sleep(ms: number): Promise<void>;
}

export const realShell: Shell = {
	launch(command, args) {
		// No windowsHide here: libuv turns it into STARTUPINFO.wShowWindow =
		// SW_HIDE, which hides the launched app's own window, not just a console.
		// Obsidian then runs windowless and holds Electron's single-instance
		// lock, so every later launch forwards its URI into a process with no
		// window. run() below keeps windowsHide, where it does the right thing
		// for the short-lived console tools.
		const child = spawn(command, args, { stdio: "ignore" });
		const exited = new Promise<ExitInfo>((resolve) => {
			let settled = false;
			child.once("exit", (code, signal) => {
				if (settled) return;
				settled = true;
				resolve({ code, signal });
			});
			child.once("error", (error) => {
				if (settled) return;
				settled = true;
				resolve({ code: null, signal: null, error: error.message });
			});
		});
		return { exited };
	},

	run(command, args, options = {}) {
		return new Promise<RunResult>((resolve) => {
			const spawnOptions: SpawnOptions = { windowsHide: true };
			if (options.cwd !== undefined) spawnOptions.cwd = options.cwd;
			if (options.env !== undefined) spawnOptions.env = options.env;
			const child = spawn(command, args, spawnOptions);
			let stdout = "";
			let stderr = "";
			let settled = false;
			child.stdout?.setEncoding("utf8");
			child.stderr?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
				stdout += chunk;
			});
			child.stderr?.on("data", (chunk: string) => {
				stderr += chunk;
			});
			child.once("error", (error) => {
				if (settled) return;
				settled = true;
				resolve({ code: null, stdout, stderr, error: error.message });
			});
			child.once("close", (code) => {
				if (settled) return;
				settled = true;
				resolve({ code, stdout, stderr });
			});
		});
	},

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	},
};

/**
 * Sync-time steps, mirroring the npm scripts. Spawning npm's .cmd shim on
 * Windows needs a shell (research §3); `node --import tsx <script>` runs the
 * same script without one.
 */
export const STEP_SCRIPTS: Record<StepName, string> = {
	glue: "tools/skill-glue/generate.ts",
	fill: "tools/frontmatter-fill/fill.ts",
	harvest: "tools/resource-harvester/harvest.ts",
	lint: "tools/vault-lint/lint.ts",
	index: "tools/index-generator/generate.ts",
	review: "tools/change-review/review.ts",
};

export function tasklistArgs(image: string): string[] {
	return ["/FI", `IMAGENAME eq ${image}`, "/NH", "/FO", "CSV"];
}

/**
 * CSV output is one `"image.exe","pid",...` line per match; no match prints
 * an INFO line instead.
 */
export function parseTasklist(stdout: string, image: string): boolean {
	const prefix = `"${image.toLowerCase()}"`;
	return stdout
		.split(/\r?\n/)
		.some((line) => line.trimStart().toLowerCase().startsWith(prefix));
}

/**
 * The one zero-dep prompt/notification mechanism (#24): inbox powershell.exe
 * + WinForms MessageBox, modal, no timeout; the answer comes back on stdout.
 */
export function messageBoxArgs(
	text: string,
	title: string,
	buttons: "YesNo" | "OK",
	icon: "Question" | "Warning" | "Error",
): string[] {
	const command =
		"Add-Type -AssemblyName System.Windows.Forms; " +
		`[System.Windows.Forms.MessageBox]::Show('${psQuote(text)}', ` +
		`'${psQuote(title)}', '${buttons}', '${icon}').ToString()`;
	return ["-NoProfile", "-Sta", "-Command", command];
}

/** Single-quote escaping; dialogs are single-line (detail goes to console). */
export function psQuote(value: string): string {
	return value.replace(/[\r\n]+/g, " ").replace(/'/g, "''");
}

/** Guarantees no mid-wrapper credential/editor prompts (research §3). */
export function gitEnv(): NodeJS.ProcessEnv {
	return {
		...process.env,
		GIT_TERMINAL_PROMPT: "0",
		GIT_EDITOR: "true",
		GIT_SEQUENCE_EDITOR: "true",
		GCM_INTERACTIVE: "0",
	};
}
