import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../lint.ts";
import { cleanup, makeTmpRoot, validNote, writeFile } from "./helpers.ts";

test("links to notes, images and Excalidraw drawings resolve", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "b.md", validNote());
	writeFile(root, "images/pic.png", "PNG");
	writeFile(root, "Excalidraw/some-drawing.md", "drawing\n");
	writeFile(
		root,
		"a.md",
		validNote("See [[b]] and ![[pic.png]] and ![[some-drawing]].\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("an unresolved target is flagged with file, rule and line", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "a.md", validNote("Line one.\n\nSee [[ghost-note]] here.\n"));

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 1);
	const v = result.violations[0];
	assert.equal(v?.file, "a.md");
	assert.equal(v?.rule, "wikilink");
	assert.equal(v?.line, 9);
	assert.match(v?.message ?? "", /unresolved wikilink target "ghost-note"/);
});

test("aliases and headings are stripped before resolution", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "b.md", validNote());
	writeFile(
		root,
		"a.md",
		validNote("[[b|an alias]] and [[b#Some Heading (With) Parens]]\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true);
});

test("folder-qualified targets resolve against vault-relative paths", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "sub/b.md", validNote());
	writeFile(root, "a.md", validNote("See [[sub/b]].\n"));

	const result = run(root);

	assert.equal(result.ok, true);
});

test("an extension-less embed resolves against the image stem", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "images/pic.png", "PNG");
	writeFile(root, "a.md", validNote("![[pic]]\n"));

	const result = run(root);

	assert.equal(result.ok, true);
});

test("links inside Excalidraw drawings are not scanned", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "a.md", validNote());
	writeFile(root, "Excalidraw/some-drawing.md", "drawing with [[ghost]]\n");

	const result = run(root);

	assert.equal(result.ok, true);
});
