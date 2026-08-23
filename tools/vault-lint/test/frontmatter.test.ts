import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../lint.ts";
import { cleanup, makeTmpRoot, validNote, writeFile } from "./helpers.ts";

test("a valid note passes", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("a note without frontmatter is flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", "No frontmatter here.\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 1);
	const v = result.violations[0];
	assert.equal(v?.file, "some-note.md");
	assert.equal(v?.rule, "frontmatter");
	assert.match(v?.message ?? "", /missing frontmatter/);
});

test("tags is required and must be a list", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "no-tags.md", "---\ncreated: 2026-08-23\n---\n\nBody.\n");
	writeFile(
		root,
		"scalar-tags.md",
		"---\ntags: not-a-list\ncreated: 2026-08-23\n---\n\nBody.\n",
	);

	const result = run(root);

	assert.equal(result.ok, false);
	const missing = result.violations.find((v) => v.file === "no-tags.md");
	assert.match(missing?.message ?? "", /missing required field "tags"/);
	const scalar = result.violations.find((v) => v.file === "scalar-tags.md");
	assert.match(scalar?.message ?? "", /"tags" must be a list/);
	assert.equal(scalar?.line, 2);
});

test("an empty tags list passes", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", "---\ntags: []\ncreated: 2026-08-23\n---\n");

	const result = run(root);

	assert.equal(result.ok, true);
});

test("created is required and must be a date", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "no-created.md", "---\ntags: []\n---\n\nBody.\n");
	writeFile(
		root,
		"bad-created.md",
		"---\ntags: []\ncreated: yesterday\n---\n\nBody.\n",
	);
	writeFile(
		root,
		"datetime-created.md",
		"---\ntags: []\ncreated: 2026-08-23T10:30:00Z\n---\n\nBody.\n",
	);

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 2);
	const missing = result.violations.find((v) => v.file === "no-created.md");
	assert.match(missing?.message ?? "", /missing required field "created"/);
	const bad = result.violations.find((v) => v.file === "bad-created.md");
	assert.match(bad?.message ?? "", /"created" must be a date/);
	assert.equal(bad?.line, 3);
});

test("draft must be a boolean when present", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"draft-note.md",
		"---\ntags: []\ncreated: 2026-08-23\ndraft: true\n---\n\nBody.\n",
	);
	writeFile(
		root,
		"draft-string.md",
		"---\ntags: []\ncreated: 2026-08-23\ndraft: yes\n---\n\nBody.\n",
	);

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 1);
	const v = result.violations[0];
	assert.equal(v?.file, "draft-string.md");
	assert.match(v?.message ?? "", /"draft" must be a boolean/);
	assert.equal(v?.line, 4);
});

test("malformed frontmatter is a violation, not a crash", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "tabbed.md", "---\n\ttags: x\ncreated: 2026-08-23\n---\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 1);
	const v = result.violations[0];
	assert.equal(v?.rule, "frontmatter");
	assert.match(v?.message ?? "", /invalid frontmatter: .*tab indentation/);
});

test("Excalidraw drawings and images/ files are not notes", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "ok-note.md", validNote());
	writeFile(root, "Excalidraw/some-drawing.md", "no frontmatter here\n");
	writeFile(root, "images/readme.md", "not a note either\n");
	writeFile(root, "images/pic.png", "PNG");

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});
