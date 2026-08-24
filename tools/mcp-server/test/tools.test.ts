import assert from "node:assert/strict";
import { test } from "node:test";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { GitHubApiError } from "../errors.ts";
import { getIndex, readFile, searchVault } from "../tools.ts";
import { stubClient } from "./helpers.ts";

function texts(result: CallToolResult): string[] {
	return result.content.map((block) => {
		assert.ok(block.type === "text");
		return block.text;
	});
}

test("get_index returns the index under a source: header", async () => {
	const client = stubClient({
		getFile: async (path) => {
			assert.equal(path, "knowledge/index.md");
			return "# Index\n\n- [[alpha]]\n";
		},
	});

	const result = await getIndex(client);

	assert.equal(result.isError, undefined);
	assert.deepEqual(texts(result), [
		"source: knowledge/index.md\n\n# Index\n\n- [[alpha]]\n",
	]);
});

test("get_index maps a GitHub failure to isError", async () => {
	const client = stubClient({
		getFile: () =>
			Promise.reject(
				new GitHubApiError(
					'GitHub API 404: no file at "knowledge/index.md"',
					404,
				),
			),
	});

	const result = await getIndex(client);

	assert.equal(result.isError, true);
	assert.match(texts(result)[0] ?? "", /404/);
});

test("read_file returns the file under a source: header", async () => {
	const client = stubClient({
		getFile: async () => "note body\n",
	});

	const result = await readFile(client, "knowledge/alpha.md");

	assert.equal(result.isError, undefined);
	assert.deepEqual(texts(result), [
		"source: knowledge/alpha.md\n\nnote body\n",
	]);
});

test("read_file rejects non-repo-relative paths without calling GitHub", async () => {
	let calls = 0;
	const client = stubClient({
		getFile: () => {
			calls++;
			return Promise.resolve("");
		},
	});

	for (const path of [
		"../secrets.md",
		"/etc/passwd",
		"knowledge//gap.md",
		"knowledge/",
	]) {
		const result = await readFile(client, path);
		assert.equal(result.isError, true, path);
		assert.match(texts(result)[0] ?? "", /invalid path/, path);
	}
	assert.equal(calls, 0);
});

test("read_file maps a 401 to isError with a GITHUB_TOKEN hint", async () => {
	const client = stubClient({
		getFile: () =>
			Promise.reject(
				new GitHubApiError(
					"GitHub API 401 Unauthorized: GITHUB_TOKEN is missing, invalid, or lacks read access",
					401,
				),
			),
	});

	const result = await readFile(client, "knowledge/alpha.md");

	assert.equal(result.isError, true);
	assert.match(texts(result)[0] ?? "", /401/);
	assert.match(texts(result)[0] ?? "", /GITHUB_TOKEN/);
});

test("search_vault emits one block per hit, each with a source: header", async () => {
	const client = stubClient({
		searchCode: async (query) => {
			assert.equal(query, "sync");
			return {
				totalCount: 2,
				hits: [
					{ path: "knowledge/sync.md", fragments: ["the sync wrapper"] },
					{ path: "knowledge/index.md", fragments: [] },
				],
			};
		},
	});

	const result = await searchVault(client, "sync");

	assert.equal(result.isError, undefined);
	assert.deepEqual(texts(result), [
		"source: knowledge/sync.md\n\nthe sync wrapper",
		"source: knowledge/index.md",
	]);
});

test("search_vault notes how many matches were not shown", async () => {
	const client = stubClient({
		searchCode: async () => ({
			totalCount: 13,
			hits: [{ path: "knowledge/sync.md", fragments: ["hit"] }],
		}),
	});

	const result = await searchVault(client, "sync");

	const blocks = texts(result);
	assert.equal(blocks.length, 2);
	assert.match(blocks[1] ?? "", /12 more match\(es\)/);
});

test("search_vault with zero hits is a plain answer, not an error", async () => {
	const client = stubClient({
		searchCode: async () => ({ totalCount: 0, hits: [] }),
	});

	const result = await searchVault(client, "nonexistent-topic");

	assert.equal(result.isError, undefined);
	assert.deepEqual(texts(result), [
		'No matches for "nonexistent-topic" in qvd808/personal-knowledge-base.',
	]);
});

test("search_vault maps a rate limit to isError with retry-after detail", async () => {
	const client = stubClient({
		searchCode: () =>
			Promise.reject(
				new GitHubApiError(
					"GitHub code search (10 req/min) rate limit exceeded; retry in 42s",
					403,
					42,
				),
			),
	});

	const result = await searchVault(client, "sync");

	assert.equal(result.isError, true);
	assert.match(texts(result)[0] ?? "", /retry in 42s/);
});

test("unexpected errors propagate instead of becoming isError", async () => {
	const client = stubClient({
		getFile: () => Promise.reject(new TypeError("bug")),
	});

	await assert.rejects(() => getIndex(client), TypeError);
});
