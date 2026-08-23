import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { deepMerge, expandEnv, formatDate, loadConfig } from "../config.ts";
import { SyncWrapperError } from "../errors.ts";
import { cleanup, makeTmpRoot, writeFile } from "./helpers.ts";

const MODULE_DIR = "tools/sync-wrapper";

function writeConfig(root: string, relative: string, value: unknown): void {
	writeFile(root, `${MODULE_DIR}/${relative}`, JSON.stringify(value));
}

test("loads committed defaults and expands env vars", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeConfig(root, "config.json", {
		obsidianExe: "%FAKE_OBSIDIAN%\\Obsidian\\Obsidian.exe",
		vaultName: "knowledge",
	});

	const config = loadConfig(
		path.join(root, MODULE_DIR),
		{ FAKE_OBSIDIAN: "C:\\Apps" },
		new Date(2026, 7, 23),
	);

	assert.equal(config.obsidianExe, "C:\\Apps\\Obsidian\\Obsidian.exe");
	assert.equal(config.vaultName, "knowledge");
	assert.equal(config.repoRoot, root);
	assert.equal(config.today, "2026-08-23");
	assert.equal(config.pollIntervalMs, 3000);
	assert.equal(config.lockWaitTimeoutMs, 60_000);
});

test("config.local.json deep-merges over config.json", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeConfig(root, "config.json", {
		obsidianExe: "%LOCALAPPDATA%\\Obsidian\\Obsidian.exe",
		vaultName: "knowledge",
		pollIntervalMs: 3000,
	});
	writeConfig(root, "config.local.json", {
		obsidianExe: "D:\\Tools\\Obsidian.exe",
		pollIntervalMs: 500,
	});

	const config = loadConfig(path.join(root, MODULE_DIR), {});

	assert.equal(config.obsidianExe, "D:\\Tools\\Obsidian.exe");
	assert.equal(config.vaultName, "knowledge");
	assert.equal(config.pollIntervalMs, 500);
});

test("unknown env vars stay literal", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeConfig(root, "config.json", {
		obsidianExe: "%NO_SUCH_VAR%\\Obsidian.exe",
		vaultName: "knowledge",
	});

	const config = loadConfig(path.join(root, MODULE_DIR), {});

	assert.equal(config.obsidianExe, "%NO_SUCH_VAR%\\Obsidian.exe");
});

test("a missing config.json is a SyncWrapperError", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));

	assert.throws(
		() => loadConfig(path.join(root, MODULE_DIR), {}),
		(error) =>
			error instanceof SyncWrapperError &&
			/config file not found/.test(error.message),
	);
});

test("invalid JSON is a SyncWrapperError", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, `${MODULE_DIR}/config.json`, "{ not json");

	assert.throws(
		() => loadConfig(path.join(root, MODULE_DIR), {}),
		(error) =>
			error instanceof SyncWrapperError && /invalid JSON/.test(error.message),
	);
});

test("a missing obsidianExe is a SyncWrapperError", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeConfig(root, "config.json", { vaultName: "knowledge" });

	assert.throws(
		() => loadConfig(path.join(root, MODULE_DIR), {}),
		(error) =>
			error instanceof SyncWrapperError && /obsidianExe/.test(error.message),
	);
});

test("deepMerge merges plain objects and replaces anything else", () => {
	const merged = deepMerge(
		{ a: 1, nested: { keep: true, drop: "x" }, list: [1, 2] },
		{ nested: { drop: "y" }, list: [3] },
	);

	assert.deepEqual(merged, {
		a: 1,
		nested: { keep: true, drop: "y" },
		list: [3],
	});
});

test("expandEnv expands every %VAR% occurrence", () => {
	assert.equal(
		expandEnv("%A%\\bin\\%B%", { A: "C:\\x", B: "y" }),
		"C:\\x\\bin\\y",
	);
});

test("formatDate pads month and day", () => {
	assert.equal(formatDate(new Date(2026, 0, 5)), "2026-01-05");
});
