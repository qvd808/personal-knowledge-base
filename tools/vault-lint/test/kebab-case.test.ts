import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../lint.ts";
import { cleanup, makeTmpRoot, validNote, writeFile } from "./helpers.ts";

test("kebab-case note, drawing and image names pass", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(root, "Excalidraw/my-drawing.md", "drawing\n");
	writeFile(root, "images/pasted-image-20250910160629.png", "PNG");

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(result.violations, []);
});

test("a non-kebab note filename is flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "Bad-Name.md", validNote());
	writeFile(root, "snake_case.md", validNote());

	const result = run(root);

	assert.equal(result.ok, false);
	assert.equal(result.violations.length, 2);
	for (const file of ["Bad-Name.md", "snake_case.md"]) {
		const v = result.violations.find((x) => x.file === file);
		assert.equal(v?.rule, "kebab-case");
		assert.match(v?.message ?? "", /not kebab-case/);
	}
});

test("a non-kebab image filename is flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(root, "images/IMG_0001.PNG", "PNG");

	const result = run(root);

	assert.equal(result.ok, false);
	const v = result.violations.find((x) => x.rule === "kebab-case");
	assert.equal(v?.file, "images/IMG_0001.PNG");
});

test("a non-kebab Excalidraw filename is flagged", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "some-note.md", validNote());
	writeFile(root, "Excalidraw/My Drawing.md", "drawing\n");

	const result = run(root);

	assert.equal(result.ok, false);
	const v = result.violations.find((x) => x.rule === "kebab-case");
	assert.equal(v?.file, "Excalidraw/My Drawing.md");
});

test("directory names are out of scope for the kebab check", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "MyFolder/ok-note.md", validNote());

	const result = run(root);

	assert.equal(result.ok, true);
});
