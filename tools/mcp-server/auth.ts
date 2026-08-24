/**
 * The #34 OAuth 2.1 shim: claude.ai custom connectors need a client
 * identity (DCR, CIMD, or pre-registered credentials) and this server has
 * none. The vault is public and the GitHub token read-only, so OAuth here
 * is ceremony for connector compatibility, not access control — CIMD,
 * stateless, auto-approve, no login page, no user store. Codes and tokens
 * are HMAC-SHA256-signed payloads via WebCrypto, so nothing is stored.
 */

/** Seconds an authorization code stays valid; the exchange is immediate. */
const CODE_TTL_SECONDS = 300;
/**
 * Seconds an access token stays valid. /mcp only checks the signature
 * (#34), so expiry is advisory; 24h keeps claude.ai from re-authing often.
 */
const TOKEN_TTL_SECONDS = 86_400;

/** The env slice the shim needs; worker.ts's Env is a superset. */
export interface OAuthEnv {
	OAUTH_SIGNING_SECRET?: string;
}

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function json(
	body: unknown,
	init: { status?: number; headers?: Record<string, string> } = {},
): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: { "content-type": "application/json", ...init.headers },
	});
}

function oauthError(
	status: number,
	error: string,
	description: string,
): Response {
	return json({ error, error_description: description }, { status });
}

function base64urlEncode(data: Uint8Array): string {
	let binary = "";
	for (const byte of data) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

/** Never throws: malformed input is simply not our token. */
function base64urlDecode(encoded: string): Uint8Array<ArrayBuffer> | undefined {
	if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) {
		return undefined;
	}
	const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
	const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
	try {
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	} catch {
		return undefined;
	}
}

/**
 * The secret's own bytes (UTF-8) are the HMAC key, so any wrangler-set
 * string works; the provisioned value is 32-byte hex from openssl.
 */
function importKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

/**
 * Signs a JSON payload as `base64url(json).base64url(hmac)` — a JWS-lite.
 * Exported so tests can mint codes with a chosen expiry.
 */
export async function signPayload(
	payload: Record<string, unknown>,
	secret: string,
): Promise<string> {
	const body = base64urlEncode(
		new TextEncoder().encode(JSON.stringify(payload)),
	);
	const key = await importKey(secret);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(body),
	);
	return `${body}.${base64urlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies the HMAC (constant-time inside subtle.verify) and parses the
 * payload; undefined on any failure, so callers have one rejection path.
 */
export async function verifyPayload(
	token: string,
	secret: string,
): Promise<Record<string, unknown> | undefined> {
	const dot = token.lastIndexOf(".");
	if (dot <= 0) return undefined;
	const body = token.slice(0, dot);
	const signature = base64urlDecode(token.slice(dot + 1));
	if (signature === undefined) return undefined;
	const key = await importKey(secret);
	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		signature,
		new TextEncoder().encode(body),
	);
	if (!valid) return undefined;
	const bytes = base64urlDecode(body);
	if (bytes === undefined) return undefined;
	try {
		const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return undefined;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

/**
 * RFC 9728 protected-resource metadata. `resource` must equal the MCP URL
 * exactly as entered in claude.ai, path included; `authorization_servers`
 * points at this worker itself — issuer and resource share one origin.
 */
function protectedResourceMetadata(origin: string): Response {
	return json({
		resource: `${origin}/mcp`,
		authorization_servers: [origin],
	});
}

/**
 * RFC 8414 authorization-server metadata. Claude picks CIMD only when both
 * CIMD fields are present (client_id_metadata_document_supported plus
 * "none" in token_endpoint_auth_methods_supported); registration_endpoint
 * is omitted entirely because a null fails client validation.
 */
function authorizationServerMetadata(origin: string): Response {
	return json({
		issuer: origin,
		authorization_endpoint: `${origin}/authorize`,
		token_endpoint: `${origin}/token`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		client_id_metadata_document_supported: true,
	});
}

function parseHttpsUrl(raw: string): URL | undefined {
	try {
		const parsed = new URL(raw);
		return parsed.protocol === "https:" ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function serverMisconfigured(): Response {
	console.error(
		JSON.stringify({ message: "OAUTH_SIGNING_SECRET is not configured" }),
	);
	return oauthError(
		500,
		"server_error",
		"authorization server is not configured",
	);
}

/**
 * Auto-approve: every parameter is validated, then the redirect fires
 * immediately with a stateless code carrying the PKCE challenge. CIMD
 * client_ids are URLs by definition; they are accepted as-is, never
 * fetched. Errors go back as 400 JSON, never as redirects to an
 * unvalidated redirect_uri.
 */
async function authorize(url: URL, secret: string): Promise<Response> {
	const params = url.searchParams;
	const responseType = params.get("response_type");
	const clientId = params.get("client_id");
	const redirectUri = params.get("redirect_uri");
	const codeChallenge = params.get("code_challenge");
	const codeChallengeMethod = params.get("code_challenge_method");
	const state = params.get("state");
	const resource = params.get("resource");

	if (responseType !== "code") {
		return oauthError(400, "invalid_request", 'response_type must be "code"');
	}
	if (clientId === null || parseHttpsUrl(clientId) === undefined) {
		return oauthError(400, "invalid_request", "client_id must be an https URL");
	}
	if (redirectUri === null) {
		return oauthError(400, "invalid_request", "redirect_uri is required");
	}
	const target = parseHttpsUrl(redirectUri);
	if (target === undefined) {
		return oauthError(
			400,
			"invalid_request",
			"redirect_uri must be an https URL",
		);
	}
	if (codeChallenge === null || codeChallenge === "") {
		return oauthError(400, "invalid_request", "code_challenge is required");
	}
	if (codeChallengeMethod !== null && codeChallengeMethod !== "S256") {
		return oauthError(
			400,
			"invalid_request",
			'code_challenge_method must be "S256"',
		);
	}
	if (state === null || state === "") {
		return oauthError(400, "invalid_request", "state is required");
	}
	if (resource === null || resource === "") {
		return oauthError(400, "invalid_request", "resource is required");
	}

	const code = await signPayload(
		{
			typ: "code",
			code_challenge: codeChallenge,
			redirect_uri: redirectUri,
			resource,
			exp: nowSeconds() + CODE_TTL_SECONDS,
		},
		secret,
	);
	target.searchParams.set("code", code);
	target.searchParams.set("state", state);
	return new Response(null, {
		status: 302,
		headers: { location: target.href },
	});
}

function formString(form: FormData, name: string): string | undefined {
	const value = form.get(name);
	return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The code exchange: signature, expiry, redirect_uri binding, and the S256
 * challenge all check out before a token is minted. Failures are RFC 6749
 * invalid_grant (not custom codes) so claude.ai's refresh/retry logic sees
 * the shapes it expects.
 */
async function token(request: Request, secret: string): Promise<Response> {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.startsWith("application/x-www-form-urlencoded")) {
		return oauthError(
			400,
			"invalid_request",
			"content-type must be application/x-www-form-urlencoded",
		);
	}
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return oauthError(400, "invalid_request", "body must be form-encoded");
	}
	if (form.get("grant_type") !== "authorization_code") {
		return oauthError(
			400,
			"unsupported_grant_type",
			'grant_type must be "authorization_code"',
		);
	}
	const code = formString(form, "code");
	const redirectUri = formString(form, "redirect_uri");
	const codeVerifier = formString(form, "code_verifier");
	if (
		code === undefined ||
		redirectUri === undefined ||
		codeVerifier === undefined
	) {
		return oauthError(
			400,
			"invalid_request",
			"code, redirect_uri, and code_verifier are required",
		);
	}
	const payload = await verifyPayload(code, secret);
	if (payload === undefined || payload.typ !== "code") {
		return oauthError(
			400,
			"invalid_grant",
			"code is malformed or tampered with",
		);
	}
	if (typeof payload.exp !== "number" || payload.exp < nowSeconds()) {
		return oauthError(400, "invalid_grant", "code has expired");
	}
	if (payload.redirect_uri !== redirectUri) {
		return oauthError(400, "invalid_grant", "redirect_uri does not match");
	}
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(codeVerifier),
	);
	if (payload.code_challenge !== base64urlEncode(new Uint8Array(digest))) {
		return oauthError(
			400,
			"invalid_grant",
			"code_verifier fails the S256 check",
		);
	}
	const accessToken = await signPayload(
		{
			typ: "access",
			resource: payload.resource,
			exp: nowSeconds() + TOKEN_TTL_SECONDS,
		},
		secret,
	);
	return json(
		{
			access_token: accessToken,
			token_type: "bearer",
			expires_in: TOKEN_TTL_SECONDS,
		},
		{ headers: { "cache-control": "no-store" } },
	);
}

function invalidToken(request: Request): Response {
	const origin = new URL(request.url).origin;
	return json(
		{
			error: "invalid_token",
			error_description: "the bearer token is malformed or tampered with",
		},
		{
			status: 401,
			headers: {
				"www-authenticate": `Bearer error="invalid_token", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
			},
		},
	);
}

/**
 * /mcp serves regardless of token presence (the data is public), but a
 * present Authorization header must hold a well-formed token: malformed or
 * tampered tokens get a 401 carrying the resource_metadata pointer, the
 * canonical discovery handshake from the connector docs. undefined means
 * "no header, or a valid token" — either way the request proceeds.
 */
export async function rejectInvalidBearer(
	request: Request,
	env: OAuthEnv,
): Promise<Response | undefined> {
	const header = request.headers.get("authorization");
	if (header === null) return undefined;
	const token = /^Bearer (\S+)$/.exec(header)?.[1];
	const secret = env.OAUTH_SIGNING_SECRET;
	if (token === undefined || secret === undefined || secret === "") {
		return invalidToken(request);
	}
	const payload = await verifyPayload(token, secret);
	if (payload === undefined || payload.typ !== "access") {
		return invalidToken(request);
	}
	return undefined;
}

/**
 * Routes the OAuth paths; undefined means "not mine" and the caller falls
 * through to the MCP handler. The `/mcp`-suffixed protected-resource path
 * is served because claude.ai probes it when the MCP URL has a path
 * component.
 */
export async function handleAuthRequest(
	request: Request,
	env: OAuthEnv,
): Promise<Response | undefined> {
	const url = new URL(request.url);
	switch (url.pathname) {
		case "/.well-known/oauth-protected-resource":
		case "/.well-known/oauth-protected-resource/":
		case "/.well-known/oauth-protected-resource/mcp":
			return protectedResourceMetadata(url.origin);
		case "/.well-known/oauth-authorization-server":
			return authorizationServerMetadata(url.origin);
		case "/authorize": {
			if (request.method !== "GET") {
				return oauthError(405, "invalid_request", "authorize is GET-only");
			}
			const secret = env.OAUTH_SIGNING_SECRET;
			if (secret === undefined || secret === "") return serverMisconfigured();
			return authorize(url, secret);
		}
		case "/token": {
			if (request.method !== "POST") {
				return oauthError(405, "invalid_request", "token is POST-only");
			}
			const secret = env.OAUTH_SIGNING_SECRET;
			if (secret === undefined || secret === "") return serverMisconfigured();
			return token(request, secret);
		}
		default:
			return undefined;
	}
}
