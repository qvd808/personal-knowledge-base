import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { run } from "../generate.ts";
import { BEGIN_MARKER, END_MARKER } from "../section.ts";
import {
	cleanup,
	exists,
	INDEX_FIXTURE,
	makeTmpRoot,
	noteMd,
	readFile,
	writeFile,
} from "./helpers.ts";

test("emits the specified section shape, replacing stale generated content", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"index.md",
		`${INDEX_FIXTURE}\n${BEGIN_MARKER}\n\nstale content\n\n${END_MARKER}\n`,
	);
	writeFile(
		root,
		"alpha.md",
		noteMd({ tags: ["b-tag", "a-tag"], created: "2026-01-02" }),
	);
	writeFile(root, "zeta.md", noteMd({ tags: [], created: "2026-02-03" }));

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(result.changed, true);
	assert.equal(
		readFile(root, "index.md"),
		`${INDEX_FIXTURE}\n${BEGIN_MARKER}\n\n## All notes\n\n- [[alpha]] — #a-tag #b-tag — 2026-01-02\n- [[zeta]] — 2026-02-03\n\n${END_MARKER}\n`,
	);
});

test("sorts notes by filename byte-order and wikilinks by basename", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(root, "zeta.md", noteMd());
	writeFile(root, "a-b.md", noteMd());
	writeFile(root, "cluster/alpha.md", noteMd());

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(
		result.entries.map((entry) => entry.name),
		["a-b", "alpha", "zeta"],
	);
	const index = readFile(root, "index.md");
	const lines = index.split("\n").filter((line) => line.startsWith("- [["));
	assert.deepEqual(lines, [
		"- [[a-b]] — #fixture — 2026-01-01",
		"- [[alpha]] — #fixture — 2026-01-01",
		"- [[zeta]] — #fixture — 2026-01-01",
	]);
});

test("excludes index.md, images/, Excalidraw/, templates/, drafts, dot-paths and non-Markdown files", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(
		root,
		"listed.md",
		noteMd({ tags: ["listed"], created: "2026-01-05" }),
	);
	writeFile(root, "images/diagram.md", noteMd());
	writeFile(root, "images/pasted.png", "PNG");
	writeFile(root, "Excalidraw/drawing.md", noteMd());
	writeFile(root, "templates/daily.md", noteMd());
	writeFile(root, "secret-plan.md", noteMd({ draft: true }));
	writeFile(root, ".trash/buried.md", noteMd());
	writeFile(root, "attachment.png", "PNG");

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(
		result.entries.map((entry) => entry.name),
		["listed"],
	);
	const index = readFile(root, "index.md");
	assert.ok(index.includes("- [[listed]] — #listed — 2026-01-05"));
	for (const absent of [
		"diagram",
		"drawing",
		"daily",
		"secret-plan",
		"buried",
		"attachment",
	]) {
		assert.ok(!index.includes(absent), absent);
	}
});

test("appends the section at the end when markers are absent", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(root, "alpha.md", noteMd({ created: "2026-01-02" }));

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(
		readFile(root, "index.md"),
		`${INDEX_FIXTURE}\n${BEGIN_MARKER}\n\n## All notes\n\n- [[alpha]] — #fixture — 2026-01-02\n\n${END_MARKER}\n`,
	);
});

test("preserves content outside the fences byte-for-byte", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "alpha.md", noteMd());
	writeFile(
		root,
		"index.md",
		`# Custom header

Hand-written intro.

${BEGIN_MARKER}

old generated content

${END_MARKER}

Hand-written footer stays.
`,
	);

	const result = run(root);

	assert.equal(result.ok, true);
	const index = readFile(root, "index.md");
	assert.ok(index.startsWith("# Custom header\n\nHand-written intro.\n"));
	assert.ok(index.endsWith("Hand-written footer stays.\n"));
	assert.ok(index.includes("- [[alpha]] — #fixture — 2026-01-01"));
	assert.ok(!index.includes("old generated content"));
});

test("is idempotent: a second run is a zero-diff no-op", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(root, "alpha.md", noteMd({ tags: ["b-tag", "a-tag"] }));
	writeFile(root, "zeta.md", noteMd());

	const first = run(root);
	assert.equal(first.ok, true);
	assert.equal(first.changed, true);
	const content = readFile(root, "index.md");

	const second = run(root);

	assert.equal(second.ok, true);
	assert.equal(second.changed, false);
	assert.equal(readFile(root, "index.md"), content);
});

test("a missing vault root is an error, not a crash", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));

	const result = run(path.join(root, "no-such-vault"));

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /vault not found/);
});

test("a missing index.md is an error and creates nothing", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "alpha.md", noteMd());

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /index\.md not found/);
	assert.equal(exists(root, "index.md"), false);
});

test("unbalanced markers are an error, never a clobber", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "alpha.md", noteMd());
	const broken = `${INDEX_FIXTURE}\n${BEGIN_MARKER}\n\nno end marker follows\n`;
	writeFile(root, "index.md", broken);

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /unbalanced/);
	assert.equal(readFile(root, "index.md"), broken);
});

test("a note without frontmatter is an error", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(root, "plain.md", "just text, no frontmatter\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /plain\.md: missing frontmatter/);
	assert.equal(readFile(root, "index.md"), INDEX_FIXTURE);
});

test("a note missing created is an error", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(root, "undated.md", "---\ntags: []\n---\n\nNo created field.\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /undated\.md: "created"/);
});

test("a note whose tags are not a list is an error", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(
		root,
		"bad-tags.md",
		"---\ntags: not-a-list\ncreated: 2026-01-01\n---\n\nBody.\n",
	);

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /bad-tags\.md: "tags"/);
});

test("a draft note with otherwise-unlistable frontmatter is still excluded", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "index.md", INDEX_FIXTURE);
	writeFile(root, "alpha.md", noteMd());
	writeFile(
		root,
		"wip.md",
		"---\ntags: []\ndraft: true\n---\n\nWork in progress, no created date.\n",
	);

	const result = run(root);

	assert.equal(result.ok, true);
	assert.deepEqual(
		result.entries.map((entry) => entry.name),
		["alpha"],
	);
});
