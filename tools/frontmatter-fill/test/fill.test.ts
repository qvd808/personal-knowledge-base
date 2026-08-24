import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { cleanup, makeTmpRoot, writeFile } from "../../lib/test/helpers.ts";
import { fillFrontmatter, renderFrontmatter } from "../fill.ts";

test("prepends frontmatter when a note has none", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "coq.md", "A language for formal verification.\n");
	const mtime = new Date("2026-08-23T12:00:00");
	fs.utimesSync(`${root}/coq.md`, mtime, mtime);

	const { filled } = fillFrontmatter(root);

	assert.deepEqual(filled, ["coq.md"]);
	const source = fs.readFileSync(`${root}/coq.md`, "utf8");
	assert.match(source, /^---\ntags:\n {2}- coq\ncreated: 2026-08-23\n---\n/);
	assert.match(source, /formal verification/);
});

test("adds missing fields without dropping existing frontmatter", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "note.md", "---\ndraft: true\n---\n\nBody.\n");
	const mtime = new Date("2026-08-20T08:00:00");
	fs.utimesSync(`${root}/note.md`, mtime, mtime);

	const { filled } = fillFrontmatter(root);

	assert.deepEqual(filled, ["note.md"]);
	const source = fs.readFileSync(`${root}/note.md`, "utf8");
	assert.match(source, /tags:\n {2}- note/);
	assert.match(source, /created: 2026-08-20/);
	assert.match(source, /draft: true/);
	assert.match(source, /Body\./);
});

test("skips notes that already satisfy the schema", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"done.md",
		"---\ntags:\n  - x\ncreated: 2026-01-01\n---\n\nOk.\n",
	);

	const { filled } = fillFrontmatter(root);

	assert.deepEqual(filled, []);
});

test("does not touch template stubs under templates/", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "templates/default.md", "no frontmatter\n");

	const { filled } = fillFrontmatter(root);

	assert.deepEqual(filled, []);
});

test("renderFrontmatter emits tags then created", () => {
	assert.equal(
		renderFrontmatter({ tags: ["a", "b"], created: "2026-08-23" }),
		"---\ntags:\n  - a\n  - b\ncreated: 2026-08-23\n---\n\n",
	);
});
