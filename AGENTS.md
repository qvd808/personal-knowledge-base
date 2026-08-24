# AGENTS.md

Agent navigation contract for this repository; see `ARCHITECTURE.md` for the system spec.

<!-- BEGIN GENERATED skill-glue: do not edit between these markers -->

## Skills

Generated from `.agents/skills/` by `npm run glue`; do not edit by hand.

- **caveman** — Ultra-compressed communication mode. Cuts output tokens 65% (measured) by speaking like caveman while keeping full technical accuracy. Supports intensity levels: lite, full (default), ultra, wenyan-lite, wenyan-full, wenyan-ultra. Use when user says "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief", or invokes /caveman. Also auto-triggers when token efficiency is requested.
- **domain-modeling** — Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a CONTEXT.md, or recording or editing an ADR.
- **grilling** — Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
- **prototype** — Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.
- **research** — Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
- **wayfinder** — Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear.

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
