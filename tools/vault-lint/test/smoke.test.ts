import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { run } from "../lint.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

test("smoke: the real knowledge/ vault passes vault-lint", () => {
	const result = run(path.join(REPO_ROOT, "knowledge"));

	assert.deepEqual(result.violations, []);
	assert.equal(result.ok, true);
});

test("a missing vault root is an error, not a crash", () => {
	const result = run(path.join(REPO_ROOT, "no-such-vault"));

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /vault not found/);
});
