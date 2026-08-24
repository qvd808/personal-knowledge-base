/**
 * Expected failure conditions talking to the GitHub API: missing or invalid
 * token, missing files, rate limits, and other non-2xx responses. Tool
 * handlers map these to MCP `isError` results; anything else is a bug and
 * propagates.
 */
export class GitHubApiError extends Error {
	/** The HTTP status GitHub returned; undefined when no request was sent. */
	readonly status: number | undefined;
	/** Seconds until the rate-limit budget refills, when GitHub said so. */
	readonly retryAfterSeconds: number | undefined;

	constructor(message: string, status?: number, retryAfterSeconds?: number) {
		super(message);
		this.name = "GitHubApiError";
		this.status = status;
		this.retryAfterSeconds = retryAfterSeconds;
	}
}
