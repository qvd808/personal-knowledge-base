# Architecture

The personal knowledge base: an Obsidian vault, self-hosted and public, where the repo
IS the product. This spec is compiled from the Architecture map
([issue #1](https://github.com/qvd808/personal-knowledge-base/issues/1)); every section
links the ticket that holds the decision's detail. A builder should be able to execute
without further decisions.

## Standing constraints

- **Free**: every component runs on a free tier or is free software.
- **Public**: the repo and the rendered site are public; no private content ever.
- **Static**: the site is fully static output on GitHub Pages.
- **Windows-first**: anything the user runs locally must work on Windows without
  Developer Mode (no symlinks anywhere).
- **Usage split**: IDE agents primarily *manage skills* (add / query / remove); web
  agents primarily *query the Vault*.
- **Citation contract**: agents cite source path + quoted passage in every answer;
  bare content without provenance is a failure mode.

## Repository layout

Locked by [Repo & vault layout (#6)](https://github.com/qvd808/personal-knowledge-base/issues/6),
amended by [Skill store format (#10)](https://github.com/qvd808/personal-knowledge-base/issues/10):

```
/
├── knowledge/              # the Vault — an Obsidian vault
│   ├── .obsidian/          # committed, minus workspace state & secrets (#16)
│   ├── images/             # central attachments folder (Obsidian paste target)
│   ├── Excalidraw/         # drawings (excluded from the public site)
│   └── index.md            # canonical agent entry point (#9)
├── .agents/skills/         # canonical skill store (#10) — generated per-tool glue
│                           #   (e.g. .claude/) is committed but never hand-edited
├── vendor/quartz/          # Quartz v4, pinned (#12)
├── tools/<module>/         # one folder per build module (see Modules)
├── docs/research/          # decision surveys (primary-source findings)
├── AGENTS.md               # agent navigation contract (#9)
└── ARCHITECTURE.md         # this file
```

**Naming**: kebab-case everywhere — files, directories, note titles.

## The Vault — content conventions

From [Content format conventions (#7)](https://github.com/qvd808/personal-knowledge-base/issues/7),
amended by [Rendering stack (#12)](https://github.com/qvd808/personal-knowledge-base/issues/12):

- **Wikilinks** `[[kebab-case-name]]` for internal notes; standard Markdown links for
  external URLs.
- **Frontmatter**: minimal schema — `tags` (list, may be empty) + `created` (date);
  optional `draft: true` excludes a note from the public site.
- **Folders**: one level, created lazily when a cluster earns it; tags over deep
  hierarchies.
- **Atomic notes**: one idea per note; titles like APIs — descriptive, kebab-case.
- **Attachments**: central `images/` folder, set as Obsidian's paste target in
  `.obsidian/app.json` (`attachmentFolderPath`). Pasted images are auto-renamed
  `pasted-images-{{DATE:YYYYMMDDHHmmss}}.png` by the Paste image rename plugin.
- **Text-or-invisible**: every note is meaningful as plain text; images support, never
  carry, content.
- **Enforcement**: Obsidian templates prefill frontmatter; `AGENTS.md` carries the
  contract; vault-lint checks at sync time.

## Vault config hygiene — the `.obsidian/` boundary

From [Vault config hygiene (#16)](https://github.com/qvd808/personal-knowledge-base/issues/16):

- **Committed**: `app.json`, `community-plugins.json`, `appearance.json`,
  `hotkeys.json`, `graph.json`, `core-plugins.json`, `templates.json`, plugin code
  (`main.js` / `manifest.json` / `styles.css`), and reviewed-clean plugin `data.json`.
- **Ignored**: `workspace.json`, `workspace-mobile.json`, `workspaces.json`, `cache/`,
  and unreviewed `plugins/*/data.json` (opt-in per plugin after eyeballing).
- **Secrets policy**: plugins needing credentials must support Obsidian's native
  Secret Storage API (secret IDs in `data.json`, values in the OS keychain); plugins
  that write secrets to `data.json` get that file ignored.
- **Deferred**: when the first secret-bearing plugin arrives, the sync wrapper gains
  render/strip (`data.json.template` with `{{SECRET:...}}` placeholders + gitignored
  `secrets.json`, rendered at launch, stripped after exit). No monkey-patch injection
  plugin — the native API obsoletes it.

## Skills

From [Skill store format & IDE-agnostic discovery (#10)](https://github.com/qvd808/personal-knowledge-base/issues/10)
and [Skills lifecycle (#15)](https://github.com/qvd808/personal-knowledge-base/issues/15):

- **Canonical store**: `.agents/skills/<name>/SKILL.md` — the agentskills.io spec
  location, read natively by Cursor, VS Code Copilot, and Gemini CLI. One skill = one
  directory; extra files (scripts, examples) ride along. Portable frontmatter core:
  `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`;
  tool-specific fields live under `metadata:`.
- **Enforcement model**: portable content, per-tool activation. Example (caveman): one
  SKILL.md with `disable-model-invocation: true` (gives `/caveman` in Claude/Cursor/VS
  Code/Gemini), a generated `.claude/output-styles/caveman.md` (only true system-prompt
  enforcement), and an always-on baseline block in `AGENTS.md`.
- **Glue**: generated, committed, never hand-edited. A Windows-clean sync script in
  `tools/` copies canonical → `.claude/skills/` and emits thin wrappers (`CLAUDE.md`
  one-line `@AGENTS.md` import, copilot-instructions, Gemini TOML when wanted).
  **No symlinks** (Windows checkout + discovery bugs in Claude Code and Cursor).
  Glue is built for Claude Code + Cursor only until other tools are actually used.
- **Lifecycle**: add/remove = plain file ops on the canonical store (IDE agent or
  human; no CLI). Query = glob + select-before-read, plus a generated name+description
  listing in a fenced section of `AGENTS.md`. Remove = delete (git is the archive) or
  `metadata: {disabled: true}` (kept, no glue emitted). The generator runs at every
  sync and may be run in-session; it fully regenerates glue (self-healing), and sync
  fails if regeneration produces a diff.

## Sync

From [Sync architecture (#5)](https://github.com/qvd808/personal-knowledge-base/issues/5),
per the [sync-on-exit survey (#4)](https://github.com/qvd808/personal-knowledge-base/issues/4)
(`docs/research/obsidian-sync-mechanisms.md`):

- **Hybrid**: obsidian-git handles pull-on-start + local-only interval commits; a
  **wrapper script** owns the exit prompt + one squashed push. (Prompt-on-close is
  impossible inside Obsidian — quit event unreliable, upstream wontfixed.)
- Wrapper scope: whole repo; auto commit messages; `git pull --rebase` before push;
  desktop notification on failure; commits stay local when offline.
- **Windows-first** wrapper; the user always launches Obsidian through it.
- The wrapper is the sync-time choke point where vault-lint, the secrets scan (#16),
  and the skill-glue generator (#10/#15) run.

## Rendering — the public site

From [Rendering stack (#12)](https://github.com/qvd808/personal-knowledge-base/issues/12),
per the [SSG survey (#11)](https://github.com/qvd808/personal-knowledge-base/issues/11)
(`docs/research/static-site-generators-obsidian.md`):

- **Quartz v4**, pinned and vendored at `vendor/quartz/` — the only surveyed option
  with first-party Obsidian-fidelity graph view (local + global), wikilinks, and
  frontmatter. Upgrades are deliberate events (v5 moved the graph to a community
  plugin). Fallback: Starlight + starlight-obsidian + starlight-site-graph.
- **Build**: `quartz build --directory knowledge` with `ignorePatterns` excluding
  `.obsidian/` and `Excalidraw/`. (Known gap: Excalidraw embeds render as broken
  transclusions until an Excalidraw→PNG export exists.)
- **Deploy**: GitHub Actions on push to main → build → Pages artifact. No custom
  domain; site at `qvd808.github.io/personal-knowledge-base`.
- **Content policy**: the whole vault is public by default; `draft: true` is the
  per-note opt-out. Exclusions are technical, not editorial.

## Agent query

From [Agent query architecture (#13)](https://github.com/qvd808/personal-knowledge-base/issues/13),
per the [hosted-MCP survey (#14)](https://github.com/qvd808/personal-knowledge-base/issues/14)
(`docs/research/hosted-mcp-cloudflare.md`):

- **Tier 0 — GitHub-as-the-API** (exists today): raw URLs, git clone, code search.
  Documented in `AGENTS.md`. "Query from claude.com" today = paste the repo/raw URL.
- **Tiers 1+2 — one stateless MCP adapter over GitHub's APIs**, two transports:
  stdio (local; needs no local clone — any agent in any project gets KB tools) and
  Streamable HTTP (Cloudflare Worker, `createMcpHandler`; NOT McpAgent/SSE —
  deprecated). IDE agents inside this repo don't need the MCP; they have the files.
- **Tool surface** (citation-friendly by construction): `get_index()` →
  `knowledge/index.md`; `search_vault(query)` → GitHub code search (10 req/min);
  `read_file(path)` → repo-relative raw content via the contents API (5,000 req/hr).
- **Worker posture**: no-auth endpoint (data is public); read-only PAT as a Worker
  secret (`wrangler secret put`, never in the repo). Accepted risk: shared-budget
  abuse degrades service, never exposes data. Gemini web is not a target.
- Web-agent native integration (Tier 2) = the Worker URL as a claude.com custom
  connector.

## Modules

What gets built (maps 2 & 3 sequence and spec these; each lives in `tools/<module>/`
except where noted):

| Module | essence | Decisions |
|---|---|---|
| sync wrapper | launch Obsidian → prompt on exit → one squashed push; runs lint/scan/glue | #5, #16 |
| skill-glue generator | `.agents/skills/` → `.claude/skills/` + wrappers + AGENTS.md listing; regen + diff check | #10, #15 |
| vault-lint | frontmatter/kebab-case/wikilink checks + secrets scan of staged `.obsidian/` | #7, #16 |
| index generator | generated section of `knowledge/index.md` at sync time | #9 |
| site build | vendor Quartz v4, Actions → Pages on push to main | #12 |
| MCP server | one codebase, stdio + Worker transports; three tools | #13 |

One-time tasks riding along: migrate `.claude/skills/` → `.agents/skills/` (six
skills), collapse caveman's three copies into one source (#10).

## Decision record

The index of decisions lives on the
[Architecture map (#1)](https://github.com/qvd808/personal-knowledge-base/issues/1);
each decision's full detail lives in its ticket. Surveys (primary-source research)
live in `docs/research/`. This file gists; it never restates.
