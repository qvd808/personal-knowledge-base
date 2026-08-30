import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorDisplayMath } from "../math-anchors.ts";
import { promoteDisplayMath } from "../math-blocks.ts";

test("wraps a fenced block whose anchor follows it", () => {
	const source = ["$$", "x = y", "$$", "^my-block", "", "After."].join("\n");

	assert.equal(
		anchorDisplayMath(source),
		[
			"",
			'<div id="my-block">',
			"",
			"$$",
			"x = y",
			"$$",
			"",
			"</div>",
			"",
			"",
			"After.",
		].join("\n"),
	);
});

test("wraps the one-line spelling too", () => {
	const source = ["$$x = y$$", "^my-block", "", "After."].join("\n");
	const wrapped = anchorDisplayMath(source);

	assert.match(wrapped, /<div id="my-block">/);
	assert.match(wrapped, /\$\$x = y\$\$/);
	assert.doesNotMatch(wrapped, /\^my-block/);
});

test("math without an anchor is left exactly as it was", () => {
	const source = ["$$", "x = y", "$$", "", "After."].join("\n");

	assert.equal(anchorDisplayMath(source), source);
});

test("an anchor on a prose paragraph is left to Quartz", () => {
	const source = ["Some prose. ^my-block", "", "After."].join("\n");

	assert.equal(anchorDisplayMath(source), source);
});

test("an anchor separated from the math by a blank line is not claimed", () => {
	const source = ["$$", "x = y", "$$", "", "^my-block"].join("\n");

	assert.equal(anchorDisplayMath(source), source);
});

test("fenced code showing the form is not touched", () => {
	const source = ["```markdown", "$$", "x = y", "$$", "^my-block", "```"].join(
		"\n",
	);

	assert.equal(anchorDisplayMath(source), source);
});

test("the wrapper survives the promotion pass that runs after it", () => {
	const source = ["$$x = y$$", "^my-block", "", "After."].join("\n");

	const built = promoteDisplayMath(anchorDisplayMath(source));

	assert.match(built, /<div id="my-block">\n\n\$\$\nx = y\n\$\$\n\n<\/div>/);
});

test("several anchored blocks in one note each keep their own id", () => {
	const source = [
		"$$",
		"a = b",
		"$$",
		"^first",
		"",
		"Prose.",
		"",
		"$$c = d$$",
		"^second",
	].join("\n");

	const wrapped = anchorDisplayMath(source);

	assert.match(wrapped, /<div id="first">/);
	assert.match(wrapped, /<div id="second">/);
	assert.doesNotMatch(wrapped, /\^first|\^second/);
});
