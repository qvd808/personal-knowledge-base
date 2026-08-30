import assert from "node:assert/strict";
import { test } from "node:test";
import { fixVault, run } from "../lint.ts";
import { findMathProblems, fixMath } from "../math.ts";
import {
	cleanup,
	makeTmpRoot,
	readFile,
	validNote,
	writeFile,
} from "./helpers.ts";

test("well-formed math raises nothing", () => {
	const source = [
		"$$",
		"\\begin{aligned}",
		"x &= y \\\\",
		"y &= z",
		"\\end{aligned}",
		"$$",
		"",
		"Inline $\\lambda x.x$ in a sentence, then a standalone block:",
		"$$x = y$$",
	].join("\n");

	assert.deepEqual(findMathProblems(source), []);
	assert.equal(fixMath(source), source);
});

test("content on the opening line is flagged and split onto its own line", () => {
	const source = "$$\\begin{aligned}\nx &= y\n\\end{aligned}\n$$\n";

	const problems = findMathProblems(source);
	assert.equal(problems.length, 1);
	assert.equal(problems[0]?.issue, "display-open-meta");
	assert.equal(problems[0]?.line, 1);

	assert.equal(
		fixMath(source),
		"$$\n\\begin{aligned}\nx &= y\n\\end{aligned}\n$$\n",
	);
});

test("content before a closing delimiter is flagged and split onto its own line", () => {
	const source = "$$\n\\begin{aligned}\nx &= y\n\\end{aligned}$$\n";

	const problems = findMathProblems(source);
	assert.equal(problems.length, 1);
	assert.equal(problems[0]?.issue, "display-close-meta");
	assert.equal(problems[0]?.line, 4);

	assert.equal(
		fixMath(source),
		"$$\n\\begin{aligned}\nx &= y\n\\end{aligned}\n$$\n",
	);
});

test("display math inside a sentence is flagged and demoted to inline", () => {
	const source =
		"For expression like $$\\lambda x.yx$$ we say that x is bound.\n";

	const problems = findMathProblems(source);
	assert.equal(problems.length, 1);
	assert.equal(problems[0]?.issue, "display-in-paragraph");
	assert.equal(problems[0]?.line, 1);

	assert.equal(
		fixMath(source),
		"For expression like $\\lambda x.yx$ we say that x is bound.\n",
	);
});

test("a display block alone on its line is left alone", () => {
	const source = "Then:\n$$(\\lambda x. M)N = M[x := N]$$\nand so on.\n";

	assert.deepEqual(findMathProblems(source), []);
	assert.equal(fixMath(source), source);
});

test("a prime after a spacing command is flagged and given an empty group", () => {
	const source =
		"$$\n\\texttt{<variable>} &::= \\texttt{v} \\mid \\texttt{<variable>}\\,'\n$$\n";

	const problems = findMathProblems(source);
	assert.equal(problems.length, 1);
	assert.equal(problems[0]?.issue, "prime-after-space");
	assert.equal(problems[0]?.line, 2);

	assert.match(fixMath(source), /\\texttt\{<variable>\}\\,\{\}'/);
});

test("fenced code showing the broken forms is not touched", () => {
	const source = [
		"```markdown",
		"$$\\begin{aligned}",
		"\\end{aligned}$$",
		"```",
		"",
	].join("\n");

	assert.deepEqual(findMathProblems(source), []);
	assert.equal(fixMath(source), source);
});

test("the rule reports through run() with file and line", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"note.md",
		validNote("Text.\n\n$$\\begin{aligned}\nx\n\\end{aligned}\n$$\n"),
	);

	const result = run(root);

	assert.equal(result.ok, false);
	const v = result.violations.find((x) => x.rule === "math-delimiters");
	assert.equal(v?.file, "note.md");
	assert.equal(v?.line, 9);
	assert.match(v?.message ?? "", /meta string/);
});

test("fixVault rewrites the offending notes and clears the rule", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"broken.md",
		validNote("$$\\begin{aligned}\nx\n\\end{aligned}$$\n"),
	);
	writeFile(root, "clean.md", validNote("Nothing to fix here.\n"));

	const fixed = fixVault(root);

	assert.deepEqual(fixed, ["broken.md"]);
	assert.match(readFile(root, "broken.md"), /\$\$\n\\begin\{aligned\}/);
	assert.equal(
		run(root).violations.filter((v) => v.rule === "math-delimiters").length,
		0,
	);
});
