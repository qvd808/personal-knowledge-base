import fs from "node:fs";
import path from "node:path";
import { SyncWrapperError } from "./errors.ts";

export interface Config {
	/** Absolute path to Obsidian.exe, env vars already expanded. */
	obsidianExe: string;
	/** Vault name for the obsidian://open URI. */
	vaultName: string;
	/** Repo root; git and the sync-time steps run here. */
	repoRoot: string;
	/** YYYY-MM-DD, local date, for the auto commit message. */
	today: string;
	/** Delay between tasklist polls (Obsidian.exe and git.exe). */
	pollIntervalMs: number;
	/** Give up waiting a live git.exe out after this long. */
	lockWaitTimeoutMs: number;
}

const DEFAULTS = {
	pollIntervalMs: 3000,
	lockWaitTimeoutMs: 60_000,
};

/** Recursive merge; plain objects merge, anything else is replaced. */
export function deepMerge(base: unknown, override: unknown): unknown {
	if (isPlainObject(base) && isPlainObject(override)) {
		const merged: Record<string, unknown> = { ...base };
		for (const [key, value] of Object.entries(override)) {
			merged[key] = key in merged ? deepMerge(merged[key], value) : value;
		}
		return merged;
	}
	return override === undefined ? base : override;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Expands Windows-style `%VAR%` references; unknown vars stay literal. */
export function expandEnv(value: string, env: NodeJS.ProcessEnv): string {
	return value.replace(
		/%([^%]+)%/g,
		(match, name: string) => env[name] ?? match,
	);
}

export function formatDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Loads `config.json` from `moduleDir`, deep-merges `config.local.json`
 * (gitignored) over it, expands env vars, and validates the result.
 */
export function loadConfig(
	moduleDir: string,
	env: NodeJS.ProcessEnv,
	now = new Date(),
): Config {
	const committed = readJson(path.join(moduleDir, "config.json"), true);
	const local = readJson(path.join(moduleDir, "config.local.json"), false);
	const raw = deepMerge(committed, local ?? {});
	if (!isPlainObject(raw)) {
		throw new SyncWrapperError("config must be a JSON object");
	}
	if (typeof raw.obsidianExe !== "string" || raw.obsidianExe === "") {
		throw new SyncWrapperError("config.obsidianExe must be a non-empty string");
	}
	if (typeof raw.vaultName !== "string" || raw.vaultName === "") {
		throw new SyncWrapperError("config.vaultName must be a non-empty string");
	}
	return {
		obsidianExe: expandEnv(raw.obsidianExe, env),
		vaultName: raw.vaultName,
		repoRoot: path.resolve(moduleDir, "..", ".."),
		today: formatDate(now),
		pollIntervalMs: numberOr(raw.pollIntervalMs, DEFAULTS.pollIntervalMs),
		lockWaitTimeoutMs: numberOr(
			raw.lockWaitTimeoutMs,
			DEFAULTS.lockWaitTimeoutMs,
		),
	};
}

function numberOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: fallback;
}

function readJson(file: string, required: boolean): unknown {
	if (!fs.existsSync(file)) {
		if (required) {
			throw new SyncWrapperError(`config file not found: ${file}`);
		}
		return undefined;
	}
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new SyncWrapperError(`invalid JSON in ${file}: ${message}`);
	}
}
