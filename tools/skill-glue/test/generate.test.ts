import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../generate.ts";
import { BEGIN_MARKER, END_MARKER } from "../plan.ts";
import {
	addStoreSkill,
	cleanup,
	exists,
	makeTmpRoot,
	readFile,
	skillMd,
	writeFile,
} from "./helpers.ts";

test("generates glue copies and the AGENTS.md listing", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha", { description: "Does a thing." });
	addStoreSkill(root, "beta", { description: "Does another thing." });

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(
		readFile(root, ".claude/skills/alpha/SKILL.md"),
		skillMd("alpha", { description: "Does a thing." }),
	);
	const agents = readFile(root, "AGENTS.md");
	assert.ok(agents.includes(BEGIN_MARKER));
	assert.ok(agents.includes(END_MARKER));
	assert.ok(agents.includes("- **alpha** — Does a thing."));
	assert.ok(agents.includes("- **beta** — Does another thing."));
});

test("copies ride-along files, including subdirectories", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha", {
		files: {
			"LOGIC.md": "logic notes\n",
			"agents/openai.yaml": "interface:\n  display_name: alpha\n",
		},
	});

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(
		readFile(root, ".claude/skills/alpha/LOGIC.md"),
		"logic notes\n",
	);
	assert.equal(
		readFile(root, ".claude/skills/alpha/agents/openai.yaml"),
		"interface:\n  display_name: alpha\n",
	);
});

test("skips disabled skills: no glue dir, no listing entry", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	addStoreSkill(root, "retired", { disabled: true });

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(exists(root, ".claude/skills/alpha/SKILL.md"), true);
	assert.equal(exists(root, ".claude/skills/retired"), false);
	const agents = readFile(root, "AGENTS.md");
	assert.ok(!agents.includes("retired"));
});

test("check mode exits clean right after generation", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	assert.equal(run(root).ok, true);

	const check = run(root, { check: true });

	assert.equal(check.ok, true);
	assert.deepEqual(check.changes, []);
});

test("check mode detects a hand-edited glue file without changing it", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	run(root);
	writeFile(root, ".claude/skills/alpha/SKILL.md", "hand-edited\n");

	const check = run(root, { check: true });

	assert.equal(check.ok, false);
	assert.ok(
		check.changes.some(
			(change) => change.path === ".claude/skills/alpha/SKILL.md",
		),
	);
	assert.equal(
		readFile(root, ".claude/skills/alpha/SKILL.md"),
		"hand-edited\n",
	);
});

test("check mode detects stale files inside a generated skill dir", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	run(root);
	writeFile(root, ".claude/skills/alpha/stale.txt", "leftover\n");

	const check = run(root, { check: true });

	assert.equal(check.ok, false);
	assert.ok(
		check.changes.some(
			(change) =>
				change.action === "delete" &&
				change.path === ".claude/skills/alpha/stale.txt",
		),
	);
});

test("generation self-heals: stale files removed, hand-edits reverted", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	run(root);
	writeFile(root, ".claude/skills/alpha/stale.txt", "leftover\n");
	writeFile(root, ".claude/skills/alpha/SKILL.md", "hand-edited\n");

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(exists(root, ".claude/skills/alpha/stale.txt"), false);
	assert.equal(
		readFile(root, ".claude/skills/alpha/SKILL.md"),
		skillMd("alpha"),
	);
	assert.equal(run(root, { check: true }).ok, true);
});

test("missing store errors out and leaves existing glue untouched", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".claude/skills/hand-written/SKILL.md", "keep me\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /skill store not found/);
	assert.equal(
		readFile(root, ".claude/skills/hand-written/SKILL.md"),
		"keep me\n",
	);
	assert.equal(exists(root, "AGENTS.md"), false);
});

test("empty store errors out and leaves existing glue untouched", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".agents/skills/.gitkeep", "");
	writeFile(root, ".claude/skills/hand-written/SKILL.md", "keep me\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /no skills/);
	assert.equal(
		readFile(root, ".claude/skills/hand-written/SKILL.md"),
		"keep me\n",
	);
	assert.equal(exists(root, "AGENTS.md"), false);
});

test("never touches .claude content outside store-skill dirs", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	writeFile(root, ".claude/skills/hand-written/SKILL.md", "keep me\n");
	writeFile(root, ".claude/settings.json", '{"hooks": {}}\n');

	const result = run(root);

	assert.equal(result.ok, true);
	assert.equal(
		readFile(root, ".claude/skills/hand-written/SKILL.md"),
		"keep me\n",
	);
	assert.equal(readFile(root, ".claude/settings.json"), '{"hooks": {}}\n');
});

test("preserves AGENTS.md content outside the markers", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	writeFile(
		root,
		"AGENTS.md",
		`# Custom header

Hand-written navigation notes.

${BEGIN_MARKER}

old generated content

${END_MARKER}

Hand-written footer stays.
`,
	);

	const result = run(root);

	assert.equal(result.ok, true);
	const agents = readFile(root, "AGENTS.md");
	assert.ok(
		agents.startsWith("# Custom header\n\nHand-written navigation notes.\n"),
	);
	assert.ok(agents.endsWith("Hand-written footer stays.\n"));
	assert.ok(agents.includes("- **alpha** — The alpha skill."));
	assert.ok(!agents.includes("old generated content"));
});

test("appends the generated section to an AGENTS.md without markers", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha");
	writeFile(root, "AGENTS.md", "# Existing doc\n\nNo markers yet.\n");

	const result = run(root);

	assert.equal(result.ok, true);
	const agents = readFile(root, "AGENTS.md");
	assert.ok(agents.startsWith("# Existing doc\n\nNo markers yet.\n"));
	assert.ok(agents.includes(BEGIN_MARKER));
	assert.ok(agents.includes("- **alpha** — The alpha skill."));
});

test("rejects a skill whose frontmatter name does not match its directory", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".agents/skills/alpha/SKILL.md", skillMd("not-alpha"));

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /does not match directory/);
	assert.equal(exists(root, ".claude/skills/alpha"), false);
});

test("rejects descriptions over 1024 chars", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	addStoreSkill(root, "alpha", { description: `x${"y".repeat(1024)}` });

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /1024/);
});

test("rejects a store directory without SKILL.md", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".agents/skills/alpha/README.md", "no skill file here\n");

	const result = run(root);

	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /no SKILL\.md/);
});
