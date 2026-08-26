import assert from "node:assert/strict";
import { test } from "node:test";
import { promoteDisplayMath } from "../math-blocks.ts";

test("promotes a one-line block that stands alone", () => {
	const source = [
		"Then:",
		"",
		"$$ F = \\lambda x . F_x$$",
		"",
		"and so on.",
	].join("\n");

	assert.equal(
		promoteDisplayMath(source),
		["Then:", "", "$$", "F = \\lambda x . F_x", "$$", "", "and so on."].join(
			"\n",
		),
	);
});

test("splits text that shares the line with the math", () => {
	const source = "For expression like $$\\lambda x.yx$$ we say that";

	assert.equal(
		promoteDisplayMath(source),
		[
			"For expression like",
			"",
			"$$",
			"\\lambda x.yx",
			"$$",
			"",
			"we say that",
		].join("\n"),
	);
});

test("separates a run of blocks glued to their surrounding prose", () => {
	const source = [
		"one can define:",
		"$$ F_{x} = \\lambda y . f(x, y)$$",
		"$$ F = \\lambda x . F_x$$",
		"Then,",
	].join("\n");

	assert.equal(
		promoteDisplayMath(source),
		[
			"one can define:",
			"",
			"$$",
			"F_{x} = \\lambda y . f(x, y)",
			"$$",
			"",
			"$$",
			"F = \\lambda x . F_x",
			"$$",
			"",
			"Then,",
		].join("\n"),
	);
});

test("promotes both blocks when one line carries two", () => {
	const source = "The expression $$F \\cdot A$$ or $$FA$$ denotes";

	assert.equal(
		promoteDisplayMath(source),
		[
			"The expression",
			"",
			"$$",
			"F \\cdot A",
			"$$",
			"",
			"or",
			"",
			"$$",
			"FA",
			"$$",
			"",
			"denotes",
		].join("\n"),
	);
});

test("leaves an already-fenced block untouched", () => {
	const source = [
		"$$",
		"\\begin{aligned}",
		"a &= b \\\\",
		"\\end{aligned}",
		"$$",
	].join("\n");

	assert.equal(promoteDisplayMath(source), source);
});

test("leaves single-dollar inline math untouched", () => {
	const source = "the function $x \\mapsto 2x+1$ applied to $3$";

	assert.equal(promoteDisplayMath(source), source);
});

test("does not touch $$ inside a fenced code block", () => {
	const source = [
		"Example:",
		"",
		"```sh",
		"echo $$ and $$ again",
		"```",
		"",
		"done.",
	].join("\n");

	assert.equal(promoteDisplayMath(source), source);
});

test("a longer closing fence still closes the block", () => {
	const source = ["````", "$$ x $$", "`````", "", "$$ y $$"].join("\n");

	// The promotion always emits a trailing blank line after the closing `$$`;
	// at end of input that shows up as a final newline, which markdown ignores.
	assert.equal(
		promoteDisplayMath(source),
		["````", "$$ x $$", "`````", "", "$$", "y", "$$", ""].join("\n"),
	);
});

test("collapses the blank lines it adds next to existing ones", () => {
	const source = ["intro", "", "$$ x = 1$$", "", "outro"].join("\n");

	assert.equal(
		promoteDisplayMath(source),
		["intro", "", "$$", "x = 1", "$$", "", "outro"].join("\n"),
	);
});

test("an unpaired $$ opening a fenced block is not promoted", () => {
	const source = ["$$", "x = 1", "$$"].join("\n");

	assert.equal(promoteDisplayMath(source), source);
});
