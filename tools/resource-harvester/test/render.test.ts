import assert from "node:assert/strict";
import { test } from "node:test";
import { resourceId } from "../ids.ts";
import {
	BEGIN_MARKER,
	END_MARKER,
	parseRegistry,
	type ResourceEntry,
	renderSection,
	spliceResourcesMd,
} from "../render.ts";

function entry(url: string, title: string, tags: string[]): ResourceEntry {
	return { id: resourceId(url), url, title, tags: new Set(tags) };
}

test("renders topic sections alphabetical by tag, entries by title", () => {
	const section = renderSection([
		entry("https://z.example/", "Zeta page", ["b-tag"]),
		entry("https://a.example/", "Alpha page", ["b-tag", "a-tag"]),
	]);
	const lines = section.split("\n");
	assert.deepEqual(lines.slice(0, 8), [
		BEGIN_MARKER,
		"",
		"## a-tag",
		"",
		"- [Alpha page](https://a.example/)",
		"",
		"## b-tag",
		"",
	]);
	assert.ok(lines.includes("- [Alpha page](https://a.example/)"));
	assert.ok(lines.includes("- [Zeta page](https://z.example/)"));
});

test("renders the URL-sorted References registry with anchored ids", () => {
	const section = renderSection([
		entry("https://z.example/", "Zeta", ["t"]),
		entry("https://a.example/", "Alpha", ["t"]),
	]);
	const lines = section.split("\n");
	const start = lines.indexOf("## References");
	assert.equal(lines[start + 1], "");
	assert.deepEqual(lines.slice(start + 2, start + 4), [
		`- https://a.example/ ^${resourceId("https://a.example/")}`,
		`- https://z.example/ ^${resourceId("https://z.example/")}`,
	]);
	assert.equal(lines[lines.length - 1], END_MARKER);
});

test("a resource appears under every tag of its owning note", () => {
	const section = renderSection([
		entry("https://x.example/", "X", ["one", "two"]),
	]);
	assert.ok(section.includes("## one"));
	assert.ok(section.includes("## two"));
	assert.equal(section.split("- [X](https://x.example/)").length - 1, 2);
});

test("splice preserves surrounding content byte-for-byte", () => {
	const existing = `front matter\n\n${BEGIN_MARKER}\n\nstale\n\n${END_MARKER}\n\ntrailing\n`;
	const next = spliceResourcesMd(
		existing,
		`${BEGIN_MARKER}\n\nfresh\n\n${END_MARKER}`,
	);
	assert.equal(
		next,
		`front matter\n\n${BEGIN_MARKER}\n\nfresh\n\n${END_MARKER}\n\ntrailing\n`,
	);
});

test("splice self-heals a file without markers by appending", () => {
	const existing = "hand-written intro\n";
	const next = spliceResourcesMd(
		existing,
		`${BEGIN_MARKER}\n\nfresh\n\n${END_MARKER}`,
	);
	assert.equal(
		next,
		`hand-written intro\n\n${BEGIN_MARKER}\n\nfresh\n\n${END_MARKER}\n`,
	);
});

test("splice loud-fails on unbalanced markers", () => {
	assert.throws(
		() =>
			spliceResourcesMd(
				`${BEGIN_MARKER}\nno end here\n`,
				`${BEGIN_MARKER}\n\n${END_MARKER}`,
			),
		/unbalanced generated-section markers/,
	);
});

test("parseRegistry reads id→URL pairs from References lines only", () => {
	const registry = parseRegistry(
		[
			"- [not a registry line](https://x.example/)",
			"- https://x.example/ ^res-1f1e4b4b",
			"- https://y.example/paper.pdf ^res-275e2f18",
			"- https://skip.example/ ^res-nothex",
		].join("\n"),
	);
	assert.equal(registry.size, 2);
	assert.equal(registry.get("res-1f1e4b4b"), "https://x.example/");
	assert.equal(registry.get("res-275e2f18"), "https://y.example/paper.pdf");
});
