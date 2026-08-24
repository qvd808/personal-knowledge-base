import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { GitHubClient } from "./github.ts";
import { REPO } from "./github.ts";
import { getIndex, readFile, searchVault } from "./tools.ts";

export const SERVER_NAME = "pkb-mcp";
export const SERVER_VERSION = "0.0.0";

/**
 * The shared core (#26): one server factory registering the three #13 tools,
 * served over stdio locally and Streamable HTTP from the Worker — transports
 * are plumbing-only. Tool descriptions carry the citation mandate because
 * the contract is mechanical: every response opens with `source: <path>`.
 */
export function createServer(client: GitHubClient): McpServer {
	const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

	server.registerTool(
		"get_index",
		{
			description: `Fetch the knowledge-base index (knowledge/index.md in ${REPO}): the canonical entry point and note listing. Start here before searching. Cite the source path and quote the passage in every answer.`,
		},
		() => getIndex(client),
	);

	server.registerTool(
		"search_vault",
		{
			description: `Full-text search over the ${REPO} knowledge base (GitHub code search, 10 req/min shared budget). Returns one text block per hit: a source: header with the repo-relative path, then the matched lines. Cite the source path and quote the passage in every answer.`,
			inputSchema: z.object({
				query: z
					.string()
					.describe("Search terms, e.g. a topic or phrase to find in notes"),
			}),
		},
		({ query }) => searchVault(client, query),
	);

	server.registerTool(
		"read_file",
		{
			description: `Read one file from ${REPO} by repo-relative path (paths come from get_index or search_vault). Returns the content under a source: header. Cite the source path and quote the passage in every answer.`,
			inputSchema: z.object({
				path: z
					.string()
					.describe('Repo-relative path, e.g. "knowledge/index.md"'),
			}),
		},
		({ path }) => readFile(client, path),
	);

	return server;
}
