# AGENTS.md

Agent navigation contract for this repository; see `ARCHITECTURE.md` for the system spec.

## Write gate — read this before editing anything

This applies to every agent working in this repository, whatever tool it runs
under: Claude Code, Cursor, Codex, Copilot, an IDE assistant, or a script.
`CLAUDE.md` states the same rules for Claude Code, which loads that file
automatically; this section exists because most other agents never read it. The
two must say the same thing — change one, change the other.

**Analysis is the default.** "Review", "check", "look at", "see if", "is there
anything wrong with" are requests for a report, not for changes. Report findings
in the chat and stop. Do not apply fixes, not even obvious or trivial ones.

**Editing needs the exact phrase.** Only edit when the user has sent, verbatim:
"For the love of everything, please edit, please help me". Ambiguous wording
("fix it", "sort this out", "can you handle it") is not approval — ask which
files you may touch before writing anything. Approval covers only the change
described; it does not extend to the next file, the next finding, or the next
turn.

**One standing exception.** The `knowledge-note` skill may create and edit files
under `docs/knowledge/` without that phrase. Nothing else is covered: not code,
not `docs/agents/`, not `docs/research/`, not `.agents/skills/`, not `CLAUDE.md`
or this file. Deleting a note is never covered, and the exception belongs to that
skill — another skill, or no skill, writing to `docs/knowledge/` still needs the
phrase. In a harness with no skill mechanism, declare it by running
`npm run gate:note`, and then follow
`.agents/skills/knowledge-note/SKILL.md` as written.

**Once approved.** Re-read every file immediately before writing to it; the
author edits these files too, sometimes mid-session, so never write from a copy
read earlier in the conversation. Make only the approved change, and mention
anything else you notice rather than fixing it. Leave the result uncommitted in
the working tree — the author commits, and does not want an agent co-author
trailer. Never run `git checkout`, `git restore`, `git reset`, `git clean`, or
`git stash` to discard working-tree changes; uncommitted work here may be the
author's.

**Sources and citations.** Every factual claim carries the URL actually fetched,
plus the work's title and its identifier. A source that could not be fetched is
reported as unfetched, in those words, never cited from memory. Anything worked
out rather than read is marked as inferred, in that word. Every path, filename,
flag and command carries its `file:line`.

### The gate is enforced, not merely asked

`tools/write-gate/gate.mjs` runs as a hook in both supported harnesses — Claude
Code via `.claude/settings.json`, Cursor via `.cursor/hooks.json` — on every
prompt, every tool call, and every shell command. Approval is derived from the
user's own message, so an agent cannot grant itself the phrase, and it is
re-derived on every message, so it never survives into the next turn. The
markers live in `.git/write-gate/`, uncommitted. `npm test` covers the rules.

The gate is about one thing: **changing this repository's content**. It is not a
restriction on doing your job. Run the app, run the tests, read status, drive the
issue tracker, install dependencies, write scratch files outside the repo — none
of that is gated, because none of it changes what the author reviews.

Blocked without approval:

- file edits to any path inside the repository, outside `docs/knowledge/`;
- writes to `docs/knowledge/` when the `knowledge-note` skill is not open;
- shell commands whose target lands inside the repository — a redirect, or
  `cp`, `mv`, `rm`, `mkdir`, `touch`, `tee`, `dd`, `chmod`, `ln`, a PowerShell
  `*-Item`/`*-Content`, or `sed -i` and friends;
- `git add`, `commit`, `push`, `apply`, `am`, `merge`, `rebase`, `revert`,
  `cherry-pick` — the author commits personally.

Blocked even *with* approval: `git checkout`, `restore`, `reset`, `clean` and
`stash`, because the uncommitted work they destroy may be the author's.

Never gated: `gh` in all its forms, so the wayfinder issue tracker works
normally; `npm`/`pnpm`/`yarn` installs and scripts; `npm test`, dev servers,
`node`, `python`, `pytest`; every read-only `git` subcommand; and any write
whose target resolves outside the repository, including a scratchpad.

Commands are judged by what they do, not by the words they contain. The command
line is tokenised and read segment by segment, so a write verb inside a quoted
string — a grep pattern, an issue body, a commit message — is text, not an
action.

What it does not block, stated plainly because an unknown hole is worse than a
documented one: a write smuggled through an interpreter (`python -c`, `node -e`),
an encoded payload, or a script invoked by name that writes as a side effect.
Treat those as violations of this contract, not as permitted routes. An agent
that tries one after being denied is doing something worse than editing without
approval.

Do not ask the user to disable the gate. If it blocks something they genuinely
want, say so and ask for the phrase.

<!-- BEGIN GENERATED skill-glue: do not edit between these markers -->

## Skills

Generated from `.agents/skills/` by `npm run glue`; do not edit by hand.

- **agents-sdk** — Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, real-time WebSocket apps, scheduled tasks, MCP servers, chat applications, voice agents, or browser automation. Covers Agent class, state management, callable RPC, Workflows, durable execution, queues, retries, observability, and React hooks. Biases towards retrieval from Cloudflare docs over pre-trained knowledge.
- **caveman** — Ultra-compressed communication mode. Cuts output tokens 65% (measured) by speaking like caveman while keeping full technical accuracy. Supports intensity levels: lite, full (default), ultra, wenyan-lite, wenyan-full, wenyan-ultra. Use when user says "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief", or invokes /caveman. Also auto-triggers when token efficiency is requested.
- **cloudflare** — Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), feature flags (Flagship), networking (Tunnel, Spectrum), security (WAF, DDoS), and infrastructure-as-code (Terraform, Pulumi). Use for any Cloudflare development task. Biases towards retrieval from Cloudflare docs over pre-trained knowledge.
- **domain-modeling** — Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a CONTEXT.md, or recording or editing an ADR.
- **grilling** — Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
- **knowledge-note** — Structure explanation notes so they teach in dependency order — the goal first, the baseline before the deviation, the mechanism before the project's decision. Use this whenever writing or revising a conceptual or explanatory document, whenever a draft turned out hard to follow, whenever a reader could not tell what a section was building toward or why it appeared where it did, and whenever a document mixes general concepts with project-specific choices or uses a term before defining it.
- **prototype** — Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.
- **research** — Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
- **verify-resources** — Verify that vault notes faithfully represent their Resources — fetch each source (transcripts for YouTube), judge fidelity per class, and report findings without editing any note. Use when the user asks to verify resources, check note-vs-source fidelity, or audit the references of one or more vault notes.
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
