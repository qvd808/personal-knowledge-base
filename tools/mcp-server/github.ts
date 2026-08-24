import { GitHubApiError } from "./errors.ts";

/**
 * The one repo this server adapts (#13): the KB stays in GitHub, the MCP
 * server is a stateless adapter over GitHub's APIs. Code search is 10
 * req/min and contents 5,000 req/hr with the read-only PAT (#14).
 */
export const REPO = "qvd808/personal-knowledge-base";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const USER_AGENT = "pkb-mcp";
/** Token efficiency: 10 hits with fragments beat GitHub's default 30. */
const SEARCH_PER_PAGE = 10;

export interface SearchHit {
	/** Repo-relative path of the matching file. */
	path: string;
	/** Matched-line fragments GitHub returned for this file (may be empty). */
	fragments: string[];
}

export interface SearchResult {
	hits: SearchHit[];
	totalCount: number;
}

export interface GitHubClient {
	getFile(path: string): Promise<string>;
	searchCode(query: string): Promise<SearchResult>;
}

export interface GitHubClientOptions {
	/** Read-only PAT; undefined means every call fails with an actionable error. */
	token: string | undefined;
	/** Fetch seam for tests; defaults to the global fetch. */
	fetchImpl?: typeof fetch;
}

function rateLimitSeconds(response: Response): number | undefined {
	const retryAfter = response.headers.get("retry-after");
	if (retryAfter !== null && /^\d+$/.test(retryAfter)) {
		return Number(retryAfter);
	}
	const remaining = response.headers.get("x-ratelimit-remaining");
	const reset = response.headers.get("x-ratelimit-reset");
	if (remaining === "0" && reset !== null && /^\d+$/.test(reset)) {
		return Math.max(0, Number(reset) - Math.floor(Date.now() / 1000));
	}
	return undefined;
}

function bodyMessage(body: string): string | undefined {
	try {
		const parsed: unknown = JSON.parse(body);
		if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
			const message = parsed.message;
			if (typeof message === "string") return message;
		}
	} catch {
		// Not JSON; no detail to extract.
	}
	return undefined;
}

/**
 * Maps a non-2xx GitHub response to a GitHubApiError. `budget` names the
 * rate-limit budget of the endpoint (search vs contents) so the message can
 * say which one ran out.
 */
async function ensureOk(
	response: Response,
	context: { notFound: string; budget: string },
): Promise<void> {
	if (response.ok) return;
	const status = response.status;
	if (status === 401) {
		throw new GitHubApiError(
			`GitHub API 401 Unauthorized: GITHUB_TOKEN is missing, invalid, or lacks read access to ${REPO}`,
			status,
		);
	}
	const retryAfter = rateLimitSeconds(response);
	if ((status === 403 || status === 429) && retryAfter !== undefined) {
		throw new GitHubApiError(
			`GitHub ${context.budget} rate limit exceeded; retry in ${retryAfter}s`,
			status,
			retryAfter,
		);
	}
	if (status === 404) {
		throw new GitHubApiError(`GitHub API 404: ${context.notFound}`, status);
	}
	const detail = bodyMessage(await response.text());
	throw new GitHubApiError(
		`GitHub API ${status}${detail === undefined ? "" : `: ${detail}`}`,
		status,
	);
}

function requireToken(token: string | undefined): string {
	if (token === undefined || token === "") {
		throw new GitHubApiError(
			"GITHUB_TOKEN is not set; provide a read-only GitHub PAT (environment variable locally, Worker secret when deployed)",
		);
	}
	return token;
}

interface TextMatch {
	fragment?: unknown;
}

interface SearchItem {
	path?: unknown;
	text_matches?: unknown;
}

interface SearchBody {
	total_count?: unknown;
	items?: unknown;
}

function parseSearchBody(body: unknown): SearchResult {
	if (typeof body !== "object" || body === null) {
		throw new GitHubApiError("GitHub code search returned a non-object body");
	}
	const { total_count, items } = body as SearchBody;
	if (typeof total_count !== "number" || !Array.isArray(items)) {
		throw new GitHubApiError(
			"GitHub code search returned an unexpected body shape",
		);
	}
	const hits: SearchHit[] = [];
	for (const item of items as SearchItem[]) {
		if (typeof item.path !== "string") continue;
		const fragments: string[] = [];
		if (Array.isArray(item.text_matches)) {
			for (const match of item.text_matches as TextMatch[]) {
				if (typeof match.fragment === "string") fragments.push(match.fragment);
			}
		}
		hits.push({ path: item.path, fragments });
	}
	return { hits, totalCount: total_count };
}

/**
 * A GitHub client over the REST API: raw file content via the contents API
 * (the raw domain takes no auth headers, #14) and code search with
 * text-match fragments. No throttling here — limits surface as errors with
 * retry-after detail (#26).
 */
export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
	const fetchImpl = options.fetchImpl ?? fetch;

	function headers(accept: string): Record<string, string> {
		return {
			accept,
			authorization: `Bearer ${requireToken(options.token)}`,
			"x-github-api-version": API_VERSION,
			"user-agent": USER_AGENT,
		};
	}

	return {
		async getFile(path: string): Promise<string> {
			const encoded = path.split("/").map(encodeURIComponent).join("/");
			const response = await fetchImpl(
				`${API_BASE}/repos/${REPO}/contents/${encoded}`,
				{ headers: headers("application/vnd.github.raw+json") },
			);
			await ensureOk(response, {
				notFound: `no file at "${path}" in ${REPO}`,
				budget: "contents (5,000 req/hour)",
			});
			return response.text();
		},

		async searchCode(query: string): Promise<SearchResult> {
			const q = encodeURIComponent(`${query} repo:${REPO}`);
			const response = await fetchImpl(
				`${API_BASE}/search/code?q=${q}&per_page=${SEARCH_PER_PAGE}`,
				{ headers: headers("application/vnd.github.text-match+json") },
			);
			await ensureOk(response, {
				notFound: `code search is unavailable for ${REPO}`,
				budget: "code search (10 req/min)",
			});
			return parseSearchBody(await response.json());
		},
	};
}
