# AGENTS.md

Agent navigation contract for this repository; see `ARCHITECTURE.md` for the system spec.

<!-- BEGIN GENERATED skill-glue: do not edit between these markers -->

## Skills

Generated from `.agents/skills/` by `npm run glue`; do not edit by hand.

- **agents-sdk** — Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, real-time WebSocket apps, scheduled tasks, MCP servers, chat applications, voice agents, or browser automation. Covers Agent class, state management, callable RPC, Workflows, durable execution, queues, retries, observability, and React hooks. Biases towards retrieval from Cloudflare docs over pre-trained knowledge.
- **caveman** — Ultra-compressed communication mode. Cuts output tokens 65% (measured) by speaking like caveman while keeping full technical accuracy. Supports intensity levels: lite, full (default), ultra, wenyan-lite, wenyan-full, wenyan-ultra. Use when user says "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief", or invokes /caveman. Also auto-triggers when token efficiency is requested.
- **cloudflare** — Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), feature flags (Flagship), networking (Tunnel, Spectrum), security (WAF, DDoS), and infrastructure-as-code (Terraform, Pulumi). Use for any Cloudflare development task. Biases towards retrieval from Cloudflare docs over pre-trained knowledge.
- **domain-modeling** — Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a CONTEXT.md, or recording or editing an ADR.
- **grilling** — Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
- **prototype** — Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.
- **research** — Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
- **wayfinder** — Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear.
- **workers-best-practices** — Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewing Worker code, configuring wrangler.jsonc, or checking for common Workers anti-patterns (streaming, floating promises, global state, secrets, bindings, observability). Biases towards retrieval from Cloudflare docs over pre-trained knowledge.
- **wrangler** — Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store. Load before running wrangler commands to ensure correct syntax and best practices. Biases towards retrieval from Cloudflare docs over pre-trained knowledge.

<!-- END GENERATED skill-glue -->

## MCP server

`tools/mcp-server/` serves the vault to agents outside this repo as three tools —
`get_index`, `search_vault`, `read_file` — over a stateless adapter on GitHub's APIs
(#13; no local clone needed). Every response opens with a `source: <repo-relative
path>` header; cite that path and quote the passage in every answer.

Local (stdio) entry, for MCP client configs — the absolute path is required:

```json
{
	"command": "npx",
	"args": ["tsx", "<absolute-path-to-repo>/tools/mcp-server/stdio.ts"],
	"env": { "GITHUB_TOKEN": "<read-only GitHub PAT>" }
}
```

Hosted (Streamable HTTP) entry: the `pkb-mcp` Cloudflare Worker at `/mcp`, deployed
with `npm run mcp:deploy` (no-auth endpoint; the PAT lives server-side as a Worker
secret).
