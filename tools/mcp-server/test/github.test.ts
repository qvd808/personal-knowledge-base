import assert from "node:assert/strict";
import { test } from "node:test";
import { GitHubApiError } from "../errors.ts";
import { createGitHubClient } from "../github.ts";
import { fakeFetch, header, jsonResponse } from "./helpers.ts";

const TOKEN = "test-token";

test("getFile fetches the contents API with the raw media type and auth headers", async () => {
	const { fetchImpl, requests } = fakeFetch(() => new Response("# Index\n"));
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const content = await client.getFile("knowledge/index.md");

	assert.equal(content, "# Index\n");
	assert.equal(requests.length, 1);
	const request = requests[0];
	assert.ok(request !== undefined);
	assert.equal(
		request.url,
		"https://api.github.com/repos/qvd808/personal-knowledge-base/contents/knowledge/index.md",
	);
	assert.equal(header(request.init, "authorization"), `Bearer ${TOKEN}`);
	assert.equal(
		header(request.init, "accept"),
		"application/vnd.github.raw+json",
	);
	assert.ok(header(request.init, "user-agent") !== null);
});

test("getFile percent-encodes path segments", async () => {
	const { fetchImpl, requests } = fakeFetch(() => new Response("x"));
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	await client.getFile("knowledge/my note.md");

	const request = requests[0];
	assert.ok(request !== undefined);
	assert.ok(request.url.endsWith("/contents/knowledge/my%20note.md"));
});

test("getFile maps 404 to an error naming the path", async () => {
	const { fetchImpl } = fakeFetch(() =>
		jsonResponse({ message: "Not Found" }, { status: 404 }),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const error = await client.getFile("knowledge/missing.md").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.equal(error.status, 404);
	assert.match(error.message, /404/);
	assert.match(error.message, /knowledge\/missing\.md/);
});

test("getFile maps 401 to an error pointing at GITHUB_TOKEN", async () => {
	const { fetchImpl } = fakeFetch(() =>
		jsonResponse({ message: "Bad credentials" }, { status: 401 }),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const error = await client.getFile("knowledge/index.md").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.equal(error.status, 401);
	assert.match(error.message, /401/);
	assert.match(error.message, /GITHUB_TOKEN/);
});

test("getFile maps a 403 rate limit with x-ratelimit-reset to retry-after detail", async () => {
	const reset = Math.floor(Date.now() / 1000) + 60;
	const { fetchImpl } = fakeFetch(() =>
		jsonResponse(
			{ message: "API rate limit exceeded" },
			{
				status: 403,
				headers: {
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": String(reset),
				},
			},
		),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const error = await client.getFile("knowledge/index.md").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.equal(error.status, 403);
	assert.ok(error.retryAfterSeconds !== undefined);
	assert.ok(error.retryAfterSeconds > 0 && error.retryAfterSeconds <= 60);
	assert.match(error.message, /contents \(5,000 req\/hour\)/);
	assert.match(error.message, /retry in \d+s/);
});

test("searchCode queries code search scoped to the repo and parses text matches", async () => {
	const { fetchImpl, requests } = fakeFetch(() =>
		jsonResponse({
			total_count: 2,
			items: [
				{
					path: "knowledge/sync.md",
					text_matches: [{ fragment: "the sync wrapper\nowns the push" }],
				},
				{ path: "knowledge/index.md" },
			],
		}),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const result = await client.searchCode("sync wrapper");

	assert.equal(result.totalCount, 2);
	assert.deepEqual(result.hits, [
		{
			path: "knowledge/sync.md",
			fragments: ["the sync wrapper\nowns the push"],
		},
		{ path: "knowledge/index.md", fragments: [] },
	]);
	const request = requests[0];
	assert.ok(request !== undefined);
	const url = new URL(request.url);
	assert.equal(url.pathname, "/search/code");
	assert.equal(
		url.searchParams.get("q"),
		"sync wrapper repo:qvd808/personal-knowledge-base",
	);
	assert.equal(
		header(request.init, "accept"),
		"application/vnd.github.text-match+json",
	);
});

test("searchCode maps a 403 with retry-after to retry-after detail", async () => {
	const { fetchImpl } = fakeFetch(() =>
		jsonResponse(
			{ message: "You have exceeded a secondary rate limit" },
			{ status: 403, headers: { "retry-after": "42" } },
		),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const error = await client.searchCode("sync").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.equal(error.status, 403);
	assert.equal(error.retryAfterSeconds, 42);
	assert.match(error.message, /code search \(10 req\/min\)/);
	assert.match(error.message, /retry in 42s/);
});

test("a 403 without rate-limit headers falls through to the generic error", async () => {
	const { fetchImpl } = fakeFetch(() =>
		jsonResponse({ message: "Forbidden" }, { status: 403 }),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const error = await client.searchCode("sync").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.equal(error.status, 403);
	assert.equal(error.retryAfterSeconds, undefined);
	assert.match(error.message, /403: Forbidden/);
});

test("other statuses surface the GitHub body message", async () => {
	const { fetchImpl } = fakeFetch(() =>
		jsonResponse({ message: "boom" }, { status: 500 }),
	);
	const client = createGitHubClient({ token: TOKEN, fetchImpl });

	const error = await client.getFile("knowledge/index.md").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.match(error.message, /500: boom/);
});

test("a missing token fails before any request is sent", async () => {
	const { fetchImpl, requests } = fakeFetch(() => new Response("x"));
	const client = createGitHubClient({ token: undefined, fetchImpl });

	const error = await client.getFile("knowledge/index.md").then(
		() => null,
		(e: unknown) => e,
	);

	assert.ok(error instanceof GitHubApiError);
	assert.match(error.message, /GITHUB_TOKEN is not set/);
	assert.equal(requests.length, 0);
});
