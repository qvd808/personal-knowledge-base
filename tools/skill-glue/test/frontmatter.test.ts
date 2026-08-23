import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSkillMd } from "../frontmatter.ts";

test("parses a minimal skill", () => {
	const result = parseSkillMd(
		"---\nname: alpha\ndescription: Does a thing.\n---\n\nBody.\n",
		"SKILL.md",
	);
	assert.equal(result.name, "alpha");
	assert.equal(result.description, "Does a thing.");
	assert.equal(result.disabled, false);
});

test("folds a > block-scalar description into one line", () => {
	const source = [
		"---",
		"name: alpha",
		"description: >",
		"  Ultra-compressed mode. Cuts tokens",
		"  while keeping full accuracy.",
		"---",
		"",
	].join("\n");
	const result = parseSkillMd(source, "SKILL.md");
	assert.equal(
		result.description,
		"Ultra-compressed mode. Cuts tokens while keeping full accuracy.",
	);
});

test("keeps newlines in a | block scalar", () => {
	const source = [
		"---",
		"name: alpha",
		"description: |",
		"  line one",
		"  line two",
		"---",
		"",
	].join("\n");
	const result = parseSkillMd(source, "SKILL.md");
	assert.equal(result.description, "line one\nline two");
});

test("reads metadata.disabled as a boolean", () => {
	const enabled = parseSkillMd(
		"---\nname: a\ndescription: x\nmetadata:\n  disabled: false\n---\n",
		"SKILL.md",
	);
	assert.equal(enabled.disabled, false);
	const disabled = parseSkillMd(
		"---\nname: a\ndescription: x\nmetadata:\n  disabled: true\n---\n",
		"SKILL.md",
	);
	assert.equal(disabled.disabled, true);
});

test("parses dash and flow lists", () => {
	const dash = parseSkillMd(
		"---\nname: a\ndescription: x\nallowed-tools:\n  - Read\n  - Grep\n---\n",
		"SKILL.md",
	);
	assert.deepEqual(dash.fields["allowed-tools"], ["Read", "Grep"]);
	const flow = parseSkillMd(
		"---\nname: a\ndescription: x\nallowed-tools: [Read, Grep]\n---\n",
		"SKILL.md",
	);
	assert.deepEqual(flow.fields["allowed-tools"], ["Read", "Grep"]);
});

test("handles quoted scalars and tool-specific keys", () => {
	const source = [
		"---",
		"name: a",
		'description: "Use when user says \\"caveman mode\\""',
		"disable-model-invocation: true",
		"license: MIT",
		"---",
		"",
	].join("\n");
	const result = parseSkillMd(source, "SKILL.md");
	assert.equal(result.description, 'Use when user says "caveman mode"');
	assert.equal(result.fields["disable-model-invocation"], true);
	assert.equal(result.fields.license, "MIT");
});

test("rejects missing fences and missing required fields", () => {
	assert.throws(
		() => parseSkillMd("name: a\ndescription: x\n", "SKILL.md"),
		/frontmatter fence/,
	);
	assert.throws(
		() => parseSkillMd("---\nname: a\n---\n", "SKILL.md"),
		/description/,
	);
	assert.throws(
		() => parseSkillMd("---\nname: a\ndescription: x\n", "SKILL.md"),
		/closing/,
	);
});
