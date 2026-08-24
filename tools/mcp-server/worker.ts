import { createMcpHandler } from "agents/mcp/server";
import { createGitHubClient } from "./github.ts";
import { createServer } from "./server.ts";

/** Worker secrets: GITHUB_TOKEN arrives via `wrangler secret put` (#13). */
interface Env {
	GITHUB_TOKEN?: string;
}

/**
 * workerd's ExecutionContext, declared minimally: the repo compiles against
 * @types/node, which has no such global, and wrangler bundles for workerd
 * where the real one exists.
 */
interface ExecutionContextLike {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

/**
 * Hosted transport (#13/#14): a no-auth Streamable HTTP endpoint (the data
 * is public by policy) at `/mcp`, stateless — one server instance per
 * request, built from the same factory as the stdio entry.
 */
export default {
	fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContextLike,
	): Promise<Response> {
		const handler = createMcpHandler(() =>
			createServer(createGitHubClient({ token: env.GITHUB_TOKEN })),
		);
		return handler(request, env, ctx);
	},
};
