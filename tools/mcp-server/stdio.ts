import process from "node:process";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createGitHubClient } from "./github.ts";
import { createServer } from "./server.ts";

/**
 * Local transport (#26): any MCP client spawns
 * `npx tsx <absolute-path-to-repo>/tools/mcp-server/stdio.ts` and gets the KB
 * tools without a local clone. GITHUB_TOKEN (a read-only PAT) comes from the
 * environment — the same code path as the Worker's secret.
 */
const token = process.env.GITHUB_TOKEN;
if (token === undefined || token === "") {
	console.error(
		"pkb-mcp: GITHUB_TOKEN is not set; tool calls will fail until it is provided",
	);
}
const client = createGitHubClient({ token });
serveStdio(() => createServer(client));
