import assert from "node:assert/strict";
import { test } from "node:test";
import { resourceId } from "../ids.ts";
import {
	bulletiseResourceLink,
	isDefinition,
	parseDefinition,
	scanLine,
} from "../patterns.ts";

const URL = "https://example.dev/guide";
const WIKILINK = `[[resources#^${resourceId(URL)}|Guide]]`;

function definitionsOf(entries: Array<[string, string]>) {
	return new Map(
		entries.map(([label, url]) => [label.toLowerCase(), { label, url }]),
	);
}

test("resourceId is res- plus 8 lowercase hex chars, stable across runs", () => {
	const id = resourceId(URL);
	assert.match(id, /^res-[0-9a-f]{8}$/);
	assert.equal(id, resourceId(`  ${URL}  `));
	assert.notEqual(id, resourceId("https://example.dev/other"));
});

test("scanLine rewrites an inline link and records its URL", () => {
	const scan = scanLine(`- [Guide](${URL})`, new Map());
	assert.equal(scan.rewritten, `- ${WIKILINK}`);
	assert.deepEqual(scan.matchedUrls, [{ url: URL, title: "Guide" }]);
	assert.equal(scan.sustainedIds.length, 0);
});

test("scanLine preserves indentation, list marker and surrounding text", () => {
	const scan = scanLine(`  - intro [Guide](${URL}) tail`, new Map());
	assert.equal(scan.rewritten, `  - intro ${WIKILINK} tail`);
});

test("scanLine rewrites every inline link on one line to the same id for one URL", () => {
	const scan = scanLine(`[A](${URL}) and [B](${URL})`, new Map());
	assert.equal(
		scan.rewritten,
		`${WIKILINK.replace("|Guide", "|A")} and ${WIKILINK.replace("|Guide", "|B")}`,
	);
	assert.equal(scan.matchedUrls.length, 2);
});

test("scanLine rejects non-http targets — the line passes through untouched", () => {
	const line = "- [local](./notes.md) and [ftp](ftp://x.example/f)";
	const scan = scanLine(line, new Map());
	assert.equal(scan.rewritten, line);
	assert.equal(scan.matchedUrls.length, 0);
});

test("scanLine rewrites a reference usage whose definition resolves", () => {
	const defs = definitionsOf([["guide", URL]]);
	const scan = scanLine("- see [the Guide][Guide]", defs);
	assert.equal(
		scan.rewritten,
		`- see [[resources#^${resourceId(URL)}|the Guide]]`,
	);
	assert.deepEqual(scan.usedLabels, ["guide"]);
	assert.deepEqual(scan.matchedUrls, [{ url: URL, title: "the Guide" }]);
});

test("reference labels match case-insensitively", () => {
	const defs = definitionsOf([["GUIDE", URL]]);
	const scan = scanLine("[text][guide]", defs);
	assert.ok(scan.rewritten.includes("^"));
	assert.deepEqual(scan.usedLabels, ["guide"]);
});

test("a reference usage without a definition passes through untouched", () => {
	const line = "- [orphan][missing]";
	const scan = scanLine(line, new Map());
	assert.equal(scan.rewritten, line);
	assert.equal(scan.usedLabels.length, 0);
});

test("already-rewritten wikilinks feed membership and are never re-rewritten", () => {
	const line = `- ${WIKILINK}`;
	const scan = scanLine(line, new Map());
	assert.equal(scan.rewritten, line);
	assert.deepEqual(scan.sustainedIds, [resourceId(URL)]);
	assert.equal(scan.aliases.get(resourceId(URL)), "Guide");
	assert.equal(scan.matchedUrls.length, 0);
});

test("RESOURCE_WIKILINK tolerates a missing alias", () => {
	const bare = `[[resources#^${resourceId(URL)}]]`;
	const scan = scanLine(bare, new Map());
	assert.deepEqual(scan.sustainedIds, [resourceId(URL)]);
	assert.equal(scan.aliases.size, 0);
});

test("definitions are recognized in both angle-bracket and bare forms", () => {
	assert.equal(isDefinition(`[guide]: <${URL}>`), true);
	assert.equal(isDefinition(`[guide]: ${URL}`), true);
	assert.equal(isDefinition(`[guide]: ./relative.md`), false);
	const parsed = parseDefinition(`  [Guide]: <${URL}>  `);
	assert.deepEqual(parsed, { label: "guide", url: URL });
});

test("bullets a bare resource wikilink", () => {
	assert.equal(
		bulletiseResourceLink(
			"[[resources#^res-72f015c2|Intro to Lambda Calculus]]",
		),
		"- [[resources#^res-72f015c2|Intro to Lambda Calculus]]",
	);
});

test("bullets a bare wikilink that carries no alias", () => {
	assert.equal(
		bulletiseResourceLink("[[resources#^res-72f015c2]]"),
		"- [[resources#^res-72f015c2]]",
	);
});

test("leaves an already-bulleted link alone", () => {
	const line = "- [[resources#^res-72f015c2|Intro to Lambda Calculus]]";
	assert.equal(bulletiseResourceLink(line), line);
});

test("leaves prose that merely mentions a resource alone", () => {
	const line = "See [[resources#^res-72f015c2|the paper]] for the proof.";
	assert.equal(bulletiseResourceLink(line), line);
});

test("leaves a line carrying two wikilinks alone", () => {
	const line =
		"[[resources#^res-72f015c2|One]] [[resources#^res-2330a1ca|Two]]";
	assert.equal(bulletiseResourceLink(line), line);
});

test("leaves a blank line alone", () => {
	assert.equal(bulletiseResourceLink(""), "");
});
