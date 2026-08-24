import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../lint.ts";
import { cleanup, makeTmpRoot, validNote, writeFile } from "./helpers.ts";

const CLEAN_APP_JSON = '{\n  "attachmentFolderPath": "images"\n}\n';

test("a clean .obsidian/ passes", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(root, ".obsidian/app.json", CLEAN_APP_JSON);
	writeFile(root, ".obsidian/community-plugins.json", '["some-plugin"]\n');

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("a GitHub token in a committable config is flagged with its line", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(
		root,
		".obsidian/app.json",
		'{\n  "attachmentFolderPath": "images",\n  "api": "ghp_abcdefghij1234567890abcdefghij"\n}\n',
	);

	const result = run(root);

	assert.equal(result.ok, false);
	const v = result.violations.find((x) => x.rule === "secrets");
	assert.equal(v?.file, ".obsidian/app.json");
	assert.equal(v?.line, 3);
	assert.match(v?.message ?? "", /GitHub token/);
});

test("github_pat_ and sk- tokens are flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(
		root,
		".obsidian/plugins/some-plugin/data.json",
		'{\n  "pat": "github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz",\n  "openai": "sk-abcdefghij1234567890abcdefghij"\n}\n',
	);

	const result = run(root);

	assert.equal(result.ok, false);
	const secretViolations = result.violations.filter(
		(x) => x.rule === "secrets",
	);
	assert.equal(secretViolations.length, 2);
	assert.equal(secretViolations[0]?.line, 2);
	assert.equal(secretViolations[1]?.line, 3);
});

test("a credential-looking value under a secret-ish key is flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(
		root,
		".obsidian/plugins/some-plugin/data.json",
		'{\n  "token": "x9Kq2mvTz8LpRwY4sHdN"\n}\n',
	);

	const result = run(root);

	assert.equal(result.ok, false);
	const v = result.violations.find((x) => x.rule === "secrets");
	assert.match(v?.message ?? "", /key "token"/);
	assert.equal(v?.line, 2);
});

test("short or placeholder values under secret-ish keys pass", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(
		root,
		".obsidian/plugins/some-plugin/data.json",
		'{\n  "token": "none",\n  "password": "{{SECRET:main}}",\n  "secret-id": "openai"\n}\n',
	);

	const result = run(root);

	assert.equal(result.ok, true);
});

test("third-party plugin code is not config and is never scanned", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(
		root,
		".obsidian/plugins/some-plugin/main.js",
		'const AI_PROVIDER_API_KEY_SET = "sk-abcdefghij1234567890abcdefghij";\n',
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("workspace state and cache are never scanned", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(
		root,
		".obsidian/workspace.json",
		'{"key": "ghp_abcdefghij1234567890abcdefghij"}\n',
	);
	writeFile(
		root,
		".obsidian/cache/data.json",
		'{"key": "sk-abcdefghij1234567890abcdefghij"}\n',
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("a vault without .obsidian/ passes", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());

	const result = run(root);

	assert.equal(result.ok, true);
});
