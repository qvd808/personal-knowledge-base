import type { GitHubClient } from "../github.ts";

export interface RecordedRequest {
	url: string;
	init: RequestInit | undefined;
}

/**
 * A fetch seam that records every call and routes to `handler`. Tests assert
 * on the request (URL, headers) and script the response — no live network.
 */
export function fakeFetch(handler: (url: string) => Response): {
	fetchImpl: typeof fetch;
	requests: RecordedRequest[];
} {
	const requests: RecordedRequest[] = [];
	const fetchImpl: typeof fetch = async (input, init) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.href
					: input.url;
		requests.push({ url, init });
		return handler(url);
	};
	return { fetchImpl, requests };
}

export function jsonResponse(
	body: unknown,
	init: { status?: number; headers?: Record<string, string> } = {},
): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		...(init.headers === undefined ? {} : { headers: init.headers }),
	});
}

export function header(
	init: RequestInit | undefined,
	name: string,
): string | null {
	return new Headers(init?.headers).get(name);
}

/** A GitHubClient stub: unstubbed methods reject, so tests notice surprises. */
export function stubClient(
	overrides: Partial<GitHubClient> = {},
): GitHubClient {
	return {
		getFile:
			overrides.getFile ??
			(() => Promise.reject(new Error("unexpected getFile call"))),
		searchCode:
			overrides.searchCode ??
			(() => Promise.reject(new Error("unexpected searchCode call"))),
	};
}
