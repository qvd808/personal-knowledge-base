import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../lint.ts";
import { cleanup, makeTmpRoot, validNote, writeFile } from "./helpers.ts";

test("a Markdown anchor link with a caret and no note is blocking", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("See [proof term](#^proof-term) here.\n\nDefinition.\n^proof-term\n"),
	);

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 1);
	const v = result.violations[0];
	assert.equal(v?.file, "a.md");
	assert.equal(v?.rule, "block-anchor");
	assert.equal(v?.line, 7);
	assert.match(v?.message ?? "", /names no note/);
	assert.match(v?.message ?? "", /\[\[a#\^proof-term\|proof term\]\]/);
});

test("a same-note wikilink with a caret and no note is blocking too", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("See [[#^tcb|TCB]] here.\n\nDefinition.\n^tcb\n"),
	);

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 1);
	assert.equal(result.violations[0]?.rule, "block-anchor");
	assert.match(
		result.violations[0]?.message ?? "",
		/\[\[a#\^tcb\|TCB\]\]/,
	);
});

test("an unaliased caret wikilink is suggested without an alias", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "a.md", validNote("See [[#^tcb]].\n\nDefinition.\n^tcb\n"));

	const result = run(root);

	assert.equal(result.violations.length, 1);
	assert.match(result.violations[0]?.message ?? "", /\[\[a#\^tcb\]\]/);
});

test("a block reference that names its note passes", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("See [[a#^tcb|TCB]] here.\n\nDefinition.\n^tcb\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
	assert.deepEqual(result.findings, []);
});

test("a caret-free heading anchor is left alone", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("See [the section](#some-heading) and [[#Some heading]].\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("a caret anchor inside a fenced code block is not flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("Never write this:\n\n```md\n[text](#^id)\n[[#^id|text]]\n```\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("a same-note reference to a missing block is a finding, not a violation", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("See [[a#^ghost|ghost]] here.\n\nDefinition.\n^tcb\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
	assert.equal(result.findings.length, 1);
	const f = result.findings[0];
	assert.equal(f?.file, "a.md");
	assert.equal(f?.rule, "block-anchor-target");
	assert.equal(f?.line, 7);
	assert.match(f?.message ?? "", /points at no block in this note/);
});

test("a cross-note block reference is never checked for existence", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "b.md", validNote("No markers here.\n"));
	writeFile(root, "a.md", validNote("See [[b#^res-a11528be|title]].\n"));

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
	assert.deepEqual(result.findings, []);
});

test("an inline trailing marker counts as a defined block", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"a.md",
		validNote("See [[a#^ct-tcb|usage]].\n\nThe passage that uses it.\n^ct-tcb\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.findings, []);
});
