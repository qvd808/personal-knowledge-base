import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { GitHubClient } from "../github.ts";
import { createServer } from "../server.ts";
import { stubClient } from "./helpers.ts";

/**
 * Wiring tests: the shared factory served over a real transport, exercised
 * by a real MCP client — registration shapes, schema validation, and the
 * citation headers end to end, with GitHub stubbed out.
 */
async function wiredClient(
	t: TestContext,
	github: GitHubClient,
): Promise<Client> {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const server = createServer(github);
	const client = new Client({ name: "pkb-mcp-test", version: "0.0.0" });
	t.after(async () => {
		await client.close();
		await server.close();
	});
	await Promise.all([
		client.connect(clientTransport),
		server.connect(serverTransport),
	]);
	return client;
}

test("the server advertises exactly the three #13 tools", async (t) => {
	const client = await wiredClient(t, stubClient());

	const { tools } = await client.listTools();

	assert.deepEqual(tools.map((tool) => tool.name).sort(), [
		"get_index",
		"read_file",
		"search_vault",
	]);
});

test("get_index over the wire carries the source: header", async (t) => {
	const client = await wiredClient(
		t,
		stubClient({ getFile: async () => "# Index\n" }),
	);

	const result = await client.callTool({ name: "get_index", arguments: {} });

	const block = result.content[0];
	assert.ok(block !== undefined && block.type === "text");
	assert.ok(block.text.startsWith("source: knowledge/index.md\n\n"));
});

test("read_file over the wire validates the path", async (t) => {
	const client = await wiredClient(t, stubClient());

	const result = await client.callTool({
		name: "read_file",
		arguments: { path: "../secrets.md" },
	});

	assert.equal(result.isError, true);
	const block = result.content[0];
	assert.ok(block !== undefined && block.type === "text");
	assert.match(block.text, /invalid path/);
});

test("search_vault over the wire emits one cited block per hit", async (t) => {
	const client = await wiredClient(
		t,
		stubClient({
			searchCode: async () => ({
				totalCount: 1,
				hits: [{ path: "knowledge/sync.md", fragments: ["the sync wrapper"] }],
			}),
		}),
	);

	const result = await client.callTool({
		name: "search_vault",
		arguments: { query: "sync" },
	});

	const block = result.content[0];
	assert.ok(block !== undefined && block.type === "text");
	assert.equal(block.text, "source: knowledge/sync.md\n\nthe sync wrapper");
});
