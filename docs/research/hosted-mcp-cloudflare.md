# Survey: hosted MCP on Cloudflare Workers free tier

Resolves [#14](https://github.com/qvd808/personal-knowledge-base/issues/14).
Research date: 2026-08-23. All claims cite primary sources (official docs, specs,
first-party changelogs).

**Question:** Can a free Cloudflare Worker host a remote MCP server as a stateless
adapter over GitHub's APIs (code search + raw file fetch), and would the target
clients (claude.com, ChatGPT, Gemini, VS Code, neovim) use it?

**TL;DR:** Yes. The Workers free tier (100k requests/day, 10 ms CPU/request) is
ample for a stateless MCP adapter. Build it with `createMcpHandler` (stateless
Streamable HTTP) — the older `McpAgent`/SSE path is deprecated. The binding
constraint is not Cloudflare but GitHub: code search is 10 req/min and *requires*
authentication, and raw.githubusercontent.com is unauthenticated-only and throttled
per-IP (60 req/hr class), so the Worker must carry a read-only PAT as a secret and
fetch file contents via the REST contents API (5,000 req/hr). All target clients
support remote MCP over Streamable HTTP; none require OAuth for a read-only
public-data server except possibly the Gemini web app (undocumented for no-auth).

---

## 1. Cloudflare Workers free tier

Source: [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
([source mdx](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/limits.mdx)),
[Pricing](https://developers.cloudflare.com/workers/platform/pricing/).

| Limit | Workers Free |
| --- | --- |
| Requests | 100,000/day, reset midnight UTC; overage → Error 1027 |
| CPU time | 10 ms per HTTP request |
| Memory | 128 MB |
| Subrequests | 50 per request |
| Simultaneous outgoing connections | 6 per request |
| Environment variables | 64 per Worker, 5 KB each |
| Worker size / startup | 3 MB / 1 s |

Notes:

- CPU time is compute time, not wall-clock — time spent waiting on outbound
  `fetch` to api.github.com does not count against the 10 ms.
  ([Limits — CPU time](https://developers.cloudflare.com/workers/platform/limits/))
- **Secrets are supported on the free tier.** Secrets are encrypted environment
  variables set via `wrangler secret put NAME`, read from `env.NAME`; local dev
  uses `.dev.vars`.
  ([Secrets](https://developers.cloudflare.com/workers/configuration/secrets/),
  [Environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/))
- **Outbound fetch to external APIs is explicitly supported and documented** —
  Cloudflare's own integration guide shows `fetch()` to third-party APIs with
  credentials stored in Wrangler secrets.
  ([Integrations — APIs](https://developers.cloudflare.com/workers/configuration/integrations/apis/),
  [External Services](https://developers.cloudflare.com/workers/configuration/integrations/external-services/))
- Each inbound MCP call can fan out to up to 50 subrequests, so a search +
  N-file-fetch tool call fits comfortably.

### Cloudflare's first-class MCP support

Source: [Build a Remote MCP server](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/),
[Transport](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/),
[createMcpHandler API](https://developers.cloudflare.com/agents/api-reference/mcp-handler-api/),
[MCP handler APIs](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/),
[McpAgent API](https://developers.cloudflare.com/agents/model-context-protocol/apis/agent-api/).

- The Agents SDK (`agents` package) provides **`createMcpHandler(server)` from
  `agents/mcp/server`**: a stateless MCP server on a plain Worker, no Durable
  Object, speaking **Streamable HTTP** (the standard remote transport since
  March 2025). This is Cloudflare's recommended path for new servers.
- **`McpAgent` is deprecated and feature-frozen.** It created stateful servers
  backed by Durable Objects; existing deployments may keep it during migration
  but new servers must not use it.
- **SSE transport is deprecated** in favor of Streamable HTTP; legacy SSE lanes
  (`createLegacyMcpHandler`) exist only for migration.
- Official guidance doc: "Build a Remote MCP server" walks through deploying a
  remote MCP server on Cloudflare with optional auth, using Streamable HTTP.

## 2. GitHub API rate limits

Source: [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
[REST API endpoints for search](https://docs.github.com/en/rest/search/search),
[Changelog: updated rate limits for unauthenticated requests (2025-05-08)](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/),
[REST API endpoints for repository contents](https://docs.github.com/en/rest/repos/contents).

| Surface | Unauthenticated | Authenticated (read-only PAT) |
| --- | --- | --- |
| REST API primary (core) | 60 req/hour, per originating IP | 5,000 req/hour per user |
| Search (issues/repos/etc.) | 10 req/min | 30 req/min |
| **Code search** (`/search/code`) | **not available — authentication required** | **10 req/min** |
| raw.githubusercontent.com | throttled per-IP (see below) | **no auth headers supported** |

- Unauthenticated requests are associated with the originating IP address, not a
  user or app. (REST rate-limit docs, "Primary rate limit for unauthenticated
  users".)
- The May 2025 changelog explicitly extends unauthenticated rate limiting to
  "downloading files from raw.githubusercontent.com" alongside anonymous REST
  calls and HTTPS clones.
- raw.githubusercontent.com does not accept authentication headers, so the
  authenticated path for file content is the REST contents API:
  `GET /repos/{owner}/{repo}/contents/{path}` with
  `Accept: application/vnd.github.raw+json`, which counts against the 5,000/hr
  core budget. (Contents API docs; the no-auth-header behavior of the raw domain
  is why the changelog pushes users to authenticated API access.)
- Secondary rate limits (concurrency/abuse) also apply and return 403/429; a
  low-volume adapter is unlikely to trip them. (REST rate-limit docs.)

**Implication:** from a Worker, unauthenticated GitHub calls would originate from
Cloudflare's shared egress IPs — an unpromising 60 req/hr bucket shared with
strangers, and code search is impossible without auth. A read-only PAT stored as
a Worker secret is effectively required. With it: 10 code searches/min and
5,000 core req/hr, far above personal-KB traffic. (Inference, grounded in the
sources above.)

## 3. Remote-MCP client support matrix (verified 2026-08-23)

| Client | Remote MCP? | Transport | Auth options | No-auth OK? |
| --- | --- | --- | --- | --- |
| claude.com / Claude Desktop / mobile | Yes — custom connectors | Remote MCP (Streamable HTTP) | OAuth 2.0 (DCR, CIMD), static headers (beta), **none** | Yes |
| ChatGPT | Yes — Developer Mode (paid plans) | SSE + Streamable HTTP, public HTTPS only | OAuth, **No Authentication**, mixed | Yes |
| Gemini web app | Yes — "Custom apps for Spark" only | MCP server URL (HTTPS) | DCR; manual credentials fallback | Not documented |
| Gemini CLI | Yes | stdio, SSE, Streamable HTTP | OAuth 2.0 w/ auto-discovery; none for open servers | Yes |
| VS Code (Copilot) | Yes | Streamable HTTP, falls back to SSE | OAuth (DCR first, client-credentials fallback), static headers, **none** | Yes |
| neovim (mcphub.nvim) | Yes | Streamable HTTP (primary), SSE (fallback), stdio | OAuth, header-based API keys, none | Yes |

Details and sources:

- **Claude (claude.com, Desktop, mobile):** custom connectors via remote MCP are
  available on Free, Pro, Max, Team, and Enterprise plans; Free users are limited
  to one custom connector. Connections are made from Anthropic's cloud
  infrastructure, so the server must be publicly reachable. Supported auth types
  include `oauth_dcr`, `oauth_cimd`, `static_headers` (beta), and **`none`
  (authless server, supported)**.
  ([Anthropic Help: custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
  [Connector authentication](https://claude.com/docs/connectors/building/authentication),
  [Custom remote MCP](https://claude.com/docs/connectors/custom/remote-mcp))
- **ChatGPT:** full MCP client support (read + write tools) via Developer Mode,
  available to Plus, Pro, Business, Enterprise, and Education accounts on the web
  (workspace admins can gate it). Only remote, publicly reachable HTTPS endpoints;
  local stdio servers are not supported directly. Supported MCP protocols: SSE
  and streaming HTTP. Authentication: OAuth (static credentials, CIMD, or DCR),
  **No Authentication**, and mixed.
  ([OpenAI: ChatGPT Developer mode](https://developers.openai.com/api/docs/guides/developer-mode),
  [OpenAI Help: Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta),
  [Apps SDK: Connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt))
- **Gemini web app:** custom MCP servers are added as "Custom apps for Spark"
  under Connected Apps at gemini.google.com — but only within **Gemini Spark**,
  which requires Spark eligibility (Google AI Pro/Ultra), a personal account,
  18+, US, English, and Keep Activity on. The flow supports Dynamic Client
  Registration, with a manual-credentials fallback; whether a fully authless
  server connects is not stated in the help page.
  ([Gemini Apps Help: custom apps for Spark](https://support.google.com/gemini/answer/17209137),
  [Connected Apps](https://support.google.com/gemini/answer/13695044))
- **Gemini CLI:** supports stdio, SSE, and Streamable HTTP transports; OAuth 2.0
  for remote servers with automatic discovery (401 → `www-authenticate` →
  well-known metadata → device flow), plus `google_credentials` and
  service-account-impersonation providers. Servers without auth connect
  directly via `httpUrl`/`url` in settings.json.
  ([Gemini CLI docs: MCP servers](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html),
  [source](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md))
- **VS Code:** remote servers configured in `mcp.json` with `"type": "http"` (or
  `"sse"`); VS Code tries Streamable HTTP first and falls back to SSE. OAuth is
  handled automatically (DCR first, client-credentials fallback; browser opens on
  first connect); static `headers` (e.g. bearer tokens) and fully unauthenticated
  servers are both supported.
  ([VS Code MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration),
  [Add and manage MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers))
- **neovim:** no built-in MCP client, but
  [mcphub.nvim](https://github.com/ravitemer/mcphub.nvim) is a mature MCP client
  supporting Streamable HTTP (primary), SSE (fallback), and stdio, with OAuth and
  header-based auth, integrating with Avante.nvim, CodeCompanion.nvim, and
  CopilotChat.nvim. ([docs](https://ravitemer.github.io/mcphub.nvim/))

## 4. Verdict for this project

1. **Free tier suffices.** 100k req/day and 10 ms CPU per request are orders of
   magnitude above personal-KB usage; outbound fetch to api.github.com and
   secrets are both first-class on the free plan.
2. **Architecture:** plain Worker + `createMcpHandler` (stateless Streamable
   HTTP). Do not use `McpAgent` or SSE — both deprecated.
3. **Binding constraint is GitHub, not Cloudflare:** code search needs auth and
   caps at 10 req/min; raw.githubusercontent.com is unauthenticated-only and
   per-IP throttled. Ship a read-only PAT as a Worker secret; use
   `/search/code` (10/min) and the contents API with the raw media type
   (5,000/hr core budget).
4. **Client reach:** claude.com (even Free plan, 1 connector), ChatGPT (paid,
   Developer Mode), Gemini CLI, VS Code, and mcphub.nvim all connect to a
   no-auth remote Streamable HTTP server. The Gemini *web* app only reaches MCP
   through Spark (paid, region-gated) and its no-auth behavior is undocumented —
   treat Gemini web as "maybe", Gemini CLI as "yes".
