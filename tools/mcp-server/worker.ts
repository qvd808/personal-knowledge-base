import { createMcpHandler } from "agents/mcp/server";
import { handleAuthRequest, rejectInvalidBearer } from "./auth.ts";
import { createGitHubClient } from "./github.ts";
import { createServer } from "./server.ts";

/** Worker secrets via `wrangler secret put`: GITHUB_TOKEN (#13), OAUTH_SIGNING_SECRET (#34). */
interface Env {
	GITHUB_TOKEN?: string;
	OAUTH_SIGNING_SECRET?: string;
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
 * Routing (#34): the OAuth shim owns the well-known paths, /authorize, and
 * /token; everything else falls through to the hosted MCP transport
 * (#13/#14) — a no-auth Streamable HTTP endpoint at `/mcp` (the data is
 * public by policy), stateless, one server instance per request. A present
 * Authorization header must hold a well-formed token, else 401.
 */
export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContextLike,
	): Promise<Response> {
		const authResponse = await handleAuthRequest(request, env);
		if (authResponse !== undefined) return authResponse;
		const bearerRejection = await rejectInvalidBearer(request, env);
		if (bearerRejection !== undefined) return bearerRejection;
		const handler = createMcpHandler(() =>
			createServer(createGitHubClient({ token: env.GITHUB_TOKEN })),
		);
		return handler(request, env, ctx);
	},
};
