import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkableFlags, maskLine } from "../check.ts";
import { isNotePath } from "../diff.ts";
import { run } from "../review.ts";
import { parseWordlist } from "../wordlist.ts";

function git(root: string, ...args: string[]): void {
	execFileSync("git", args, { cwd: root, windowsHide: true });
}

function commitAll(root: string): void {
	git(root, "add", "-A");
	git(
		root,
		"-c",
		"user.name=t",
		"-c",
		"user.email=t@example.dev",
		"commit",
		"-m",
		"init",
	);
}

const WORDLIST = [
	"# comment",
	"",
	"udpate->update",
	"Galina->Gallina",
	"verilog",
].join("\n");

test("parseWordlist splits pairs and exempt words, reporting malformed lines", () => {
	const parsed = parseWordlist(`${WORDLIST}\nbroken->\nudpate->other\n`);
	assert.equal(parsed.wordlist.swaps.get("udpate"), "update");
	assert.equal(parsed.wordlist.swaps.get("galina"), "Gallina");
	assert.ok(parsed.wordlist.exempt.has("verilog"));
	assert.equal(parsed.errors.length, 2);
	assert.match(parsed.errors[0] ?? "", /line 6: empty side/);
	assert.match(parsed.errors[1] ?? "", /already mapped/);
});

test("maskLine blanks code spans, URLs, images, wikilink targets and block ids", () => {
	const masked = maskLine(
		"See `state_next` at https://x.example/a?q=1 and ![img](images/p.png) plus [[resources#^res-1a2b3c4d|Gallina FIFO paper]] [[other-note]] and ^blockid9",
	);
	assert.ok(!masked.includes("state_next"));
	assert.ok(!masked.includes("https://"));
	assert.ok(!masked.includes("p.png"));
	assert.ok(!masked.includes("res-1a2b3c4d"));
	assert.ok(!masked.includes("other-note"));
	assert.ok(masked.includes("Gallina FIFO paper"));
	assert.ok(!masked.includes("^blockid9"));
});

test("checkableFlags excludes frontmatter and fenced regions including fences", () => {
	const lines = [
		"---",
		"tags: udpate",
		"---",
		"prose udpate here",
		"```verilog",
		"reg udpate;",
		"```",
		"more udpate prose",
	];
	assert.deepEqual(checkableFlags(lines), [
		false,
		false,
		false,
		true,
		false,
		false,
		false,
		true,
	]);
});

test("isNotePath filters generated files, non-notes and excluded dirs", () => {
	assert.equal(isNotePath("apio.md"), true);
	assert.equal(isNotePath("index.md"), false);
	assert.equal(isNotePath("resources.md"), false);
	assert.equal(isNotePath("images/pasted.md"), false);
	assert.equal(isNotePath("Excalidraw/d.md"), false);
	assert.equal(isNotePath("templates/t.md"), false);
	assert.equal(isNotePath("diagram.png"), false);
});

test("run reviews only added lines of changed and untracked notes", (t) => {
	const root = fs.mkdtempSync(path.join(process.env.TEMP ?? ".", "pkb-cr-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	git(root, "init", "-q");

	const committed = [
		"---",
		"tags:",
		"  - fixture",
		"created: 2026-01-01",
		"---",
		"# Note",
		"",
		"old line stays silent even with udpate here.",
	].join("\n");
	fs.mkdirSync(path.join(root, "knowledge"), { recursive: true });
	fs.writeFileSync(path.join(root, "knowledge", "a.md"), `${committed}\n`);
	commitAll(root);

	// Tracked edit: one clean line, one misspelled line.
	fs.writeFileSync(
		path.join(root, "knowledge", "a.md"),
		`${committed}\nI need to udpate this note.\n`,
	);
	// Untracked note: every line is added, but only prose is checked.
	fs.writeFileSync(
		path.join(root, "knowledge", "b.md"),
		[
			"---",
			"tags:",
			"  - fixture",
			"created: 2026-01-02",
			"---",
			"The Galina paper explains FIFOs.",
			"`udpate` in code is fine.",
		].join("\n"),
	);

	const result = run(root);

	assert.equal(result.ok, true, result.error ?? "no error");
	assert.equal(result.changedNotes, 2);
	const described = result.findings.map(
		(f) => `${f.file}:${f.line} ${f.wrong}->${f.right}`,
	);
	assert.deepEqual(described, [
		"a.md:9 udpate->update",
		"b.md:6 Galina->Gallina",
	]);
});
