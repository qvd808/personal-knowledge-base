import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { handleAuthRequest, signPayload, verifyPayload } from "../auth.ts";
import worker from "../worker.ts";

/**
 * The #34 OAuth shim, tested offline: a fixed signing secret is injected
 * via the env seam, and the MCP handler is exercised through the wrapped
 * worker fetch with GitHub untouched (initialize never calls tools).
 */
const SECRET = "test-signing-secret-0123456789abcdef0123456789abcdef";
const ENV = { OAUTH_SIGNING_SECRET: SECRET };
const ORIGIN = "https://pkb-mcp.test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const RESOURCE = `${ORIGIN}/mcp`;

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

/** Response.json() is `unknown` here; guard once, then read fields. */
async function bodyJson(response: Response): Promise<Record<string, unknown>> {
	const body: unknown = await response.json();
	assert.ok(typeof body === "object" && body !== null);
	return body as Record<string, unknown>;
}

function s256(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

function authorizeUrl(params: Record<string, string>): string {
	const url = new URL(`${ORIGIN}/authorize`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.href;
}

function validAuthorizeParams(codeChallenge: string): Record<string, string> {
	return {
		response_type: "code",
		client_id: "https://claude.ai/oauth/test-client-metadata",
		redirect_uri: REDIRECT,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		state: "state-123",
		resource: RESOURCE,
	};
}

async function runAuthorize(params: Record<string, string>): Promise<Response> {
	const response = await handleAuthRequest(
		new Request(authorizeUrl(params)),
		ENV,
	);
	assert.ok(response !== undefined);
	return response;
}

function tokenRequest(code: string, verifier: string, redirectUri: string) {
	return new Request(`${ORIGIN}/token`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			code_verifier: verifier,
			resource: RESOURCE,
		}).toString(),
	});
}

async function runToken(request: Request): Promise<Response> {
	const response = await handleAuthRequest(request, ENV);
	assert.ok(response !== undefined);
	return response;
}

/** Authorize → 302 → code, the shared setup for the rejection cases. */
async function mintCode(verifier: string): Promise<string> {
	const response = await runAuthorize(validAuthorizeParams(s256(verifier)));
	assert.equal(response.status, 302);
	const location = new URL(response.headers.get("location") ?? "");
	const code = location.searchParams.get("code");
	assert.ok(code !== null && code !== "");
	return code;
}

function mcpInitializeRequest(authorization?: string): Request {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		accept: "application/json, text/event-stream",
	};
	if (authorization !== undefined) headers.authorization = authorization;
	return new Request(`${ORIGIN}/mcp`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "auth-test", version: "0.0.0" },
			},
		}),
	});
}

test("protected-resource metadata points at the worker's own origin", async () => {
	for (const path of [
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-protected-resource/mcp",
	]) {
		const response = await handleAuthRequest(
			new Request(`${ORIGIN}${path}`),
			ENV,
		);
		assert.ok(response !== undefined);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			resource: RESOURCE,
			authorization_servers: [ORIGIN],
		});
	}
});

test("authorization-server metadata advertises CIMD, no registration_endpoint", async () => {
	const response = await handleAuthRequest(
		new Request(`${ORIGIN}/.well-known/oauth-authorization-server`),
		ENV,
	);
	assert.ok(response !== undefined);
	assert.equal(response.status, 200);
	const body = await bodyJson(response);
	assert.equal(body.issuer, ORIGIN);
	assert.equal(body.authorization_endpoint, `${ORIGIN}/authorize`);
	assert.equal(body.token_endpoint, `${ORIGIN}/token`);
	assert.deepEqual(body.response_types_supported, ["code"]);
	assert.deepEqual(body.grant_types_supported, ["authorization_code"]);
	assert.deepEqual(body.code_challenge_methods_supported, ["S256"]);
	assert.deepEqual(body.token_endpoint_auth_methods_supported, ["none"]);
	assert.equal(body.client_id_metadata_document_supported, true);
	assert.ok(!("registration_endpoint" in body));
});

test("authorize → token round-trips with a real S256 verifier", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const authorizeResponse = await runAuthorize(
		validAuthorizeParams(s256(verifier)),
	);
	assert.equal(authorizeResponse.status, 302);
	const location = new URL(authorizeResponse.headers.get("location") ?? "");
	assert.equal(`${location.origin}${location.pathname}`, REDIRECT);
	assert.equal(location.searchParams.get("state"), "state-123");
	const code = location.searchParams.get("code");
	assert.ok(code !== null && code !== "");

	const tokenResponse = await runToken(tokenRequest(code, verifier, REDIRECT));
	assert.equal(tokenResponse.status, 200);
	assert.equal(tokenResponse.headers.get("cache-control"), "no-store");
	const body = await bodyJson(tokenResponse);
	assert.equal(body.token_type, "bearer");
	assert.equal(typeof body.expires_in, "number");
	const accessToken = body.access_token;
	assert.ok(typeof accessToken === "string");
	const payload = await verifyPayload(accessToken, SECRET);
	assert.equal(payload?.typ, "access");
	assert.equal(payload?.resource, RESOURCE);
});

test("a tampered code is rejected as invalid_grant", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const code = await mintCode(verifier);
	const middle = Math.floor(code.length / 2);
	const replacement = code[middle] === "A" ? "B" : "A";
	const tampered = code.slice(0, middle) + replacement + code.slice(middle + 1);

	const response = await runToken(tokenRequest(tampered, verifier, REDIRECT));

	assert.equal(response.status, 400);
	assert.equal((await bodyJson(response)).error, "invalid_grant");
});

test("the wrong code_verifier fails the S256 check", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const code = await mintCode(verifier);
	const wrongVerifier = randomBytes(32).toString("base64url");

	const response = await runToken(tokenRequest(code, wrongVerifier, REDIRECT));

	assert.equal(response.status, 400);
	assert.equal((await bodyJson(response)).error, "invalid_grant");
});

test("an expired code is rejected", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const code = await signPayload(
		{
			typ: "code",
			code_challenge: s256(verifier),
			redirect_uri: REDIRECT,
			resource: RESOURCE,
			exp: Math.floor(Date.now() / 1000) - 60,
		},
		SECRET,
	);

	const response = await runToken(tokenRequest(code, verifier, REDIRECT));

	assert.equal(response.status, 400);
	assert.equal((await bodyJson(response)).error, "invalid_grant");
});

test("a redirect_uri mismatch is rejected", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const code = await mintCode(verifier);

	const response = await runToken(
		tokenRequest(code, verifier, "https://evil.example/callback"),
	);

	assert.equal(response.status, 400);
	assert.equal((await bodyJson(response)).error, "invalid_grant");
});

test("an http redirect_uri is rejected at authorize, not redirected", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const response = await runAuthorize({
		...validAuthorizeParams(s256(verifier)),
		redirect_uri: "http://example.com/callback",
	});

	assert.equal(response.status, 400);
	assert.equal(response.headers.get("location"), null);
});

test("a missing resource parameter is rejected at authorize", async () => {
	const verifier = randomBytes(32).toString("base64url");
	const params = validAuthorizeParams(s256(verifier));
	delete params.resource;

	const response = await runAuthorize(params);

	assert.equal(response.status, 400);
	assert.equal((await bodyJson(response)).error, "invalid_request");
});

test("the MCP handler still answers through the wrapped fetch", async () => {
	const response = await worker.fetch(mcpInitializeRequest(), ENV, ctx);

	assert.equal(response.status, 200);
	assert.match(await response.text(), /pkb-mcp/);
});

test("a malformed Bearer token gets a 401 with the discovery pointer", async () => {
	const response = await worker.fetch(
		mcpInitializeRequest("Bearer not-a-real-token"),
		ENV,
		ctx,
	);

	assert.equal(response.status, 401);
	const authenticate = response.headers.get("www-authenticate") ?? "";
	assert.match(authenticate, /error="invalid_token"/);
	assert.match(
		authenticate,
		new RegExp(
			`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
		),
	);
});

test("a tampered Bearer token is rejected even though it parses", async () => {
	const valid = await signPayload(
		{
			typ: "access",
			resource: RESOURCE,
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		SECRET,
	);
	const tampered = `${valid.slice(0, -2)}${valid.endsWith("AA") ? "BB" : "AA"}`;

	const response = await worker.fetch(
		mcpInitializeRequest(`Bearer ${tampered}`),
		ENV,
		ctx,
	);

	assert.equal(response.status, 401);
});

test("a valid Bearer token passes through to the MCP handler", async () => {
	const accessToken = await signPayload(
		{
			typ: "access",
			resource: RESOURCE,
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		SECRET,
	);

	const response = await worker.fetch(
		mcpInitializeRequest(`Bearer ${accessToken}`),
		ENV,
		ctx,
	);

	assert.equal(response.status, 200);
	assert.match(await response.text(), /pkb-mcp/);
});
