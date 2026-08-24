import type { CallToolResult } from "@modelcontextprotocol/server";
import { GitHubApiError } from "./errors.ts";
import type { GitHubClient } from "./github.ts";
import { REPO } from "./github.ts";

/** The #9 hub: agents enter the vault at knowledge/index.md. */
export const INDEX_PATH = "knowledge/index.md";

function textResult(text: string): CallToolResult {
	return { content: [{ type: "text", text }] };
}

function errorResult(message: string): CallToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Maps expected GitHub failures to `isError` results with terse actionable
 * messages (rate limits carry retry-after detail, #26). Unexpected errors
 * are bugs and propagate to the SDK's own error surface.
 */
async function guard(
	run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof GitHubApiError) {
			return errorResult(error.message);
		}
		throw error;
	}
}

export function getIndex(client: GitHubClient): Promise<CallToolResult> {
	return guard(async () => {
		const content = await client.getFile(INDEX_PATH);
		return textResult(`source: ${INDEX_PATH}\n\n${content}`);
	});
}

/** Rejects paths the contents API should never see; returns the complaint. */
function invalidPath(path: string): string | undefined {
	const segments = path.split("/");
	if (
		path.startsWith("/") ||
		segments.some((segment) => segment === "" || segment === "..")
	) {
		return `invalid path "${path}": use a repo-relative path like "${INDEX_PATH}"`;
	}
	return undefined;
}

export function readFile(
	client: GitHubClient,
	path: string,
): Promise<CallToolResult> {
	const complaint = invalidPath(path);
	if (complaint !== undefined) {
		return Promise.resolve(errorResult(complaint));
	}
	return guard(async () => {
		const content = await client.getFile(path);
		return textResult(`source: ${path}\n\n${content}`);
	});
}

export function searchVault(
	client: GitHubClient,
	query: string,
): Promise<CallToolResult> {
	return guard(async () => {
		const { hits, totalCount } = await client.searchCode(query);
		if (hits.length === 0) {
			return textResult(`No matches for "${query}" in ${REPO}.`);
		}
		const content: CallToolResult["content"] = hits.map((hit) => ({
			type: "text" as const,
			text: `source: ${hit.path}\n\n${hit.fragments.join("\n\n")}`.trimEnd(),
		}));
		if (totalCount > hits.length) {
			content.push({
				type: "text" as const,
				text: `${totalCount - hits.length} more match(es) in ${REPO} not shown; refine the query to narrow results.`,
			});
		}
		return { content };
	});
}
