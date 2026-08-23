# Token-efficient KB conventions for agents

Research for issue #8. Question: what conventions let LLM agents navigate a
Markdown knowledge base with minimal token spend, and what does each convention
cost the agent (in tokens) and the human (in upkeep)?

Method: primary sources only — spec sites, official docs, first-party repos.
Each claim carries its source URL. Token/upkeep assessments are analysis built
on the cited facts. Research date: 2026-08-23.

Framing fact from the llms.txt spec: "Context windows, while larger than they
were, are still too small for most websites in their entirety, and every wasted
token costs time and money. Agents are best served by concise, expert-level
information gathered in a single, accessible location."
Source: https://llmstxt.org/

---

## 1. `llms.txt`

**What it is.** A proposal (v2, Jeremy Howard / Answer.AI) to place a Markdown
file named `llms.txt` at a site root — or at any subpath, covering the pages
under that path — giving brief background, guidance, and links to detailed
Markdown files. The format is fixed and machine-parseable: an H1 with the
project name (the only required section), a blockquote summary, optional
free-form Markdown sections, then zero or more H2-delimited "file lists" of
hyperlinks with optional notes. An `## Optional` section holds links an agent
may skip when a shorter context is needed. The proposal also recommends serving
a clean Markdown version of every page at the same URL with `.md` appended or
replacing the extension, discoverable via `rel="alternate"
type="text/markdown"` and `rel="describedby"` link relations (HTML `<link>` or
HTTP `Link:` header).
Source: https://llmstxt.org/

**How agents consume it.** "Agents are expected to view or search `llms.txt` to
find the information they need, then follow the relevant links... The file
itself stays small enough to fit in context. The detail lives behind the links,
and is fetched only when needed." Where more than one `llms.txt` applies, agents
use the most specific one.
Source: https://llmstxt.org/

**Adoption.** Per the spec site: thousands of sites publish an `llms.txt`;
documentation platforms (Mintlify, GitBook, Wix, Yoast SEO, AIOSEO) generate
one automatically; Chrome's Lighthouse audits sites for one as part of its
agentic browsing checks; OpenAI, Anthropic, and Gemini publish `llms.txt` files
for their own developer docs.
Source: https://llmstxt.org/

**Token cost to the agent.** One small file read up front (the spec's own
guidance: concise language, brief link descriptions, test by giving an agent
only the `llms.txt`), then pay full-file cost only for linked detail actually
needed. This is the convention's core design goal.
Source: https://llmstxt.org/

**Upkeep cost to the human.** A curated link list that must be updated as
content is added, renamed, or removed — the spec recommends testing it against
real agent questions. Docs platforms can generate it automatically, but for a
plain Markdown KB it is manual. No enforcement mechanism exists; a stale
`llms.txt` silently misroutes agents.
Source: https://llmstxt.org/

**KB fit.** A root `llms.txt` is a strong "start here" for a repo-consumed KB:
one H1, a blockquote describing the vault, and H2 file lists pointing at MOCs
or high-value notes, with an `## Optional` section for skippable material.

---

## 2. `AGENTS.md`

**What it is.** "A simple, open format for guiding coding agents... a README
for agents: a dedicated, predictable place to provide context and
instructions." Deliberately separate from README.md so agent-only detail (build
steps, tests, conventions) doesn't clutter human docs. Plain Markdown, no
required fields.
Sources: https://agents.md/ , https://raw.githubusercontent.com/agentsmd/agents.md/main/README.md

**Which tools read it.** The convention emerged from OpenAI Codex, Amp, Jules
(Google), Cursor, and Factory; the site lists GitHub Copilot's coding agent and
UiPath among supported agents and claims 60k+ AGENTS.md files on GitHub. It is
now stewarded by the Agentic AI Foundation under the Linux Foundation. Aider
reads it via `read: AGENTS.md` in `.aider.conf.yml`; Gemini CLI via
`context.fileName` in `.gemini/settings.json`. Agents read it automatically —
no tool call needed — and in monorepos "agents automatically read the nearest
file in the directory tree, so the closest one takes precedence" (the main
OpenAI repo reportedly has 88 nested AGENTS.md files). Conflict rule: the
closest AGENTS.md to the edited file wins; explicit user prompts override
everything.
Source: https://agents.md/

**Token cost to the agent.** Near zero marginal cost: supporting agents inject
the file into context automatically, so the agent spends no search or read tool
calls discovering conventions. The cost is the file's own length on every
session — which argues for keeping it short and operational.

**Upkeep cost to the human.** Write once, then "treat AGENTS.md as living
documentation" — update when workflows change. For a KB (not a code project)
its role is different: it carries *navigation rules* ("search with ripgrep,
start at the index, notes are atomic") rather than a content map.
Source: https://agents.md/

**KB fit.** Complementary to `llms.txt`: `AGENTS.md` tells the agent *how to
work* in the repo; `llms.txt`/MOCs tell it *where the content is*. This repo
already uses CLAUDE.md in that spirit.

---

## 3. Index / Map-of-Content (MOC) files as agent entry points

**What it is.** From Nick Milo's Linking Your Thinking (LYT) framework: "An
M—O—C is a cluster of information that maps 'things' in context with other
'things'... MOCs help you gather, develop, and navigate ideas." A MOC is an
ordinary Markdown note whose body is mostly links to other notes, created "when
you start to feel that tickle of overwhelm (Mental Squeeze Point)" and kept as
"a reliable navigational tool to the rest of your digital library."
Source: https://notes.linkingyourthinking.com/Cards/MOCs+Overview

**How agents consume it.** There is no machine standard — a MOC is just a note
full of links — so an agent consumes it exactly as a human does: read the hub
note (small), follow the relevant links. A top-level `Home`/index note linking
to MOCs gives a one-file entry point; this is the same hub-and-spoke shape as
`llms.txt`, but expressed as ordinary notes instead of a spec'd file.
Source: https://notes.linkingyourthinking.com/Cards/MOCs+Overview

**Token cost to the agent.** Low and proportional: one hub note per topic
instead of a directory listing or broad grep. Cost scales with MOC quality — a
MOC with annotated links lets the agent pick one target note instead of
fetching several candidates.

**Upkeep cost to the human.** Fully manual and ongoing: LYT's own guidance is
to create a MOC when a cluster of notes becomes hard to navigate, and to keep
adding links as new notes arrive. Nothing enforces freshness; an unmaintained
MOC decays into a wrong map. Cheaper than frontmatter-everything (only hub
notes need editing), but requires the human to actually do the cartography.
Source: https://notes.linkingyourthinking.com/Cards/MOCs+Overview

---

## 4. YAML frontmatter-driven search and filtering

**What it is.** Obsidian "properties": YAML (or JSON) frontmatter at the top of
a note, with typed values (text, list, number, checkbox, date, date & time,
tags) and default properties `tags`, `aliases`, `cssclasses`. Obsidian's own
constraint: "properties are meant for small, atomic bits of information that
are both human and machine readable"; Markdown is intentionally not rendered
inside properties.
Source: https://help.obsidian.md/properties

**How agents consume it.** Two paths. (a) Obsidian's Search supports property
queries: `[aliases]` finds notes with the property, `[status:Draft OR
Published]` matches values, `[aliases:null]` finds empty ones, with grouping,
quotes, and regex in sub-queries. (b) Outside Obsidian, frontmatter is plain
text at a fixed offset, so an agent can filter a whole vault with one ripgrep
call, e.g. `rg -l '^status: published'` or `rg -l '^tags:.*crawler'` — no file
contents need to enter context, only matching paths.
Sources: https://help.obsidian.md/plugins/search , https://help.obsidian.md/properties

**Token cost to the agent.** Very low for *selection*: a property filter
returns a path list, and the agent fetches only those notes. The offsetting
cost is per-note overhead — every note carries its metadata block, so every
full-note read includes the frontmatter tokens. Obsidian's design ("small,
atomic bits") keeps that overhead small.
Source: https://help.obsidian.md/properties

**Upkeep cost to the human.** The highest of the conventions surveyed if
applied uniformly: every note needs its properties added and kept correct, and
Obsidian explicitly does not support bulk-editing properties natively ("we
recommend using bulk-editing tools like VSCode, scripts, and community
plugins") or nested properties. A minimal schema (e.g. only `tags` and
`status`) keeps this tractable; a rich schema turns into a database-maintenance
job.
Source: https://help.obsidian.md/properties

---

## 5. GitHub code search and raw fetching as an agent query path

**Code search (web UI).** GitHub code search supports regular expressions
(`/pattern/`), boolean operations (`AND`/`OR`/`NOT`, parentheses), exact
strings, and qualifiers including `repo:`, `org:`, `user:`, `language:`,
`path:` (with globs like `path:/src/**/*.js`), `symbol:`, `content:`, and
`is:`. Important for agents: "You must be logged in to a GitHub account to use
code search, including for searching code in public repositories." Limitations:
only the default branch is searchable; queries are capped at 1,000 characters;
results are capped at 100; vendored/generated code, empty files, files over
350 KiB, non-UTF-8 files, and files with very long lines are excluded from the
index.
Sources: https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax , https://docs.github.com/en/search-github/github-code-search/about-github-code-search

**Code search (API / CLI).** The REST `search/code` endpoint "requires you to
authenticate and limits you to 10 requests per minute" (other search endpoints:
30 req/min authenticated, 10 req/min unauthenticated). `gh search code` wraps
the API, supports `--repo`, `--language`, `--filename`, `--match {file|path}`,
and `--json` output (fields: `path`, `repository`, `sha`, `textMatches`,
`url`), but the CLI manual warns results are "powered by what is now a legacy
GitHub code search engine... new features like regex search are not yet
available via the GitHub API."
Sources: https://docs.github.com/en/rest/search/search#search-code , https://cli.github.com/manual/gh_search_code

**Unauthenticated access.** Unauthenticated REST API requests to public data
are limited to 60 requests per hour per originating IP; authenticated requests
get 5,000/hour. Separately, `raw.githubusercontent.com` serves public-repo
files without any credentials — verified empirically 2026-08-23:
`curl -sI https://raw.githubusercontent.com/BurntSushi/ripgrep/master/README.md`
returned HTTP 200 with no `Authorization` header. The REST contents API offers
the same payload authenticated via the `application/vnd.github.raw+json` media
type ("Returns the raw file contents for files and symlinks").
Sources: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api , https://docs.github.com/en/rest/repos/contents#get-repository-content

**Token cost to the agent.** Search returns paths plus short text matches —
cheap triage — then the agent pays full-file tokens only for the raw files it
chooses to fetch. For a public KB repo this is a viable remote query path with
no local clone: `gh search code` (authenticated, 10 req/min) to locate, plain
unauthenticated `raw.githubusercontent.com` GETs to read. The 60 req/hour
unauthenticated REST ceiling makes the REST contents API a poor bulk-crawl
path; raw-file GETs and `gh` are the practical routes.
Sources: as above.

**Upkeep cost to the human.** Zero beyond pushing the repo to GitHub — the
index is GitHub's problem. The trade-off: no curation lever, default-branch
only, and the 100-result cap can hide notes in a large vault.
Source: https://docs.github.com/en/search-github/github-code-search/about-github-code-search

---

## 6. ripgrep-friendly repo structure

**What ripgrep gives an agent.** ripgrep "recursively searches the current
directory for a regex pattern. By default, ripgrep will respect gitignore rules
and automatically skip hidden files/directories and binary files." Its
automatic filtering honors `.gitignore` globs (including parent-directory and
global ones), `.ignore` files (which take precedence over `.gitignore`), hidden
files, and binary files (any file containing a NUL byte). `-u`, `-uu`, `-uuu`
progressively disable that filtering; `-g` globs and `--type` filters give
manual control.
Sources: https://raw.githubusercontent.com/BurntSushi/ripgrep/master/README.md , https://raw.githubusercontent.com/BurntSushi/ripgrep/master/GUIDE.md

**Structural implications (analysis grounded in the above).**

- *Naming is the index.* Because `rg` matches paths as well as content and
  supports glob filtering, descriptive kebab-case filenames
  (`crawler-rate-limits.md`, not `note-37.md`) let an agent shortlist
  candidates from `rg --files` output alone — zero file-content tokens.
- *Flat beats deep.* ripgrep doesn't care about hierarchy, but the agent's
  context does: every result line carries the full path, so deep nesting
  multiplies path tokens in search output and adds disambiguation chatter. A
  flat or one-level vault with strong names maximizes signal per result line.
- *Keep noise out of the corpus.* Since ripgrep auto-skips gitignored, hidden,
  and binary files, keeping exports, assets, and generated files covered by
  `.gitignore`/`.ignore` directly cuts the tokens an agent spends on
  irrelevant matches.
- *Plain text only.* Binary files are skipped by default, so anything an agent
  should find must live in Markdown/text, not in embedded binaries.

**Token cost to the agent.** The lowest per-query cost of any convention here:
one `rg` call returns only matching lines/paths — no whole files enter context
until the agent chooses to read them. Requires a local clone (or GitHub code
search as the remote stand-in, section 5).

**Upkeep cost to the human.** Naming discipline on every note, plus occasional
`.gitignore`/`.ignore` curation. No hub files to maintain; the discipline is
distributed across every file creation.
Source: https://raw.githubusercontent.com/BurntSushi/ripgrep/master/GUIDE.md

---

## 7. Note-sizing norms: atomic notes vs long documents

**What the sources say.** Andy Matuschak: "It's best to create notes which are
only about one thing—but which, as much as possible, capture the entirety of
that thing." Too broad, and "links to that note will be muddied"; too
fragmented, and "you'll also fragment your link network." He analogizes to
separation of concerns and notes "Evergreen note titles are like APIs." His
references cite the Zettelkasten method's "principle of atomicity: put things
which belong together in a Zettel, but try to separate concerns from one
another."
Source: https://notes.andymatuschak.org/z4Rrmh17vMBbauEGnFPTZSK3UmdsGExLRfZz1

**Token implications (analysis).**

- *Atomic notes* make retrieval granular: an agent that navigates links, MOCs,
  or grep hits to a single-concept note pays for exactly that concept — the
  whole file is small enough to read outright. The link graph does the
  filtering work that context would otherwise do.
- *Long documents* invert the cost: cheap to write, expensive to query. The
  agent must either pay full-file tokens or do multi-step partial reads
  (grep for headings, read line ranges). It is no accident that Obsidian's
  Search has `section:`, `block:`, and `line:` operators — they exist to locate
  fragments inside long notes, which is precisely the extra work long documents
  impose on any consumer.
  Source: https://help.obsidian.md/plugins/search
- Matuschak's "titles are like APIs" cuts both ways for agents: atomic notes
  make filenames/titles a high-precision selection layer (compounding the
  ripgrep-naming benefit in section 6), but only if titles stay descriptive.

**Upkeep cost to the human.** Atomicity is a writing discipline, not a tool:
more notes to title, more links to maintain ("Evergreen notes should be
densely linked" — same source), and Matuschak himself warns there is "no clear
litmus test or correct answer here—just a bunch of tradeoffs." Long documents
cost less to produce but tax every future reader, human or agent.
Source: https://notes.andymatuschak.org/z4Rrmh17vMBbauEGnFPTZSK3UmdsGExLRfZz1

---

## Comparison: token efficiency per unit of human upkeep

| Convention | Agent token cost | Human upkeep | Auto-consumed by agents? |
|---|---|---|---|
| `llms.txt` | One small file + on-demand link fetches | Curate/maintain one link list | By agents that know to look; spec'd format |
| `AGENTS.md` | ~Zero marginal (auto-injected); file length per session | Low; update when workflows change | Yes, by major coding agents |
| MOC / index notes | One hub note per topic, then targeted fetches | Manual cartography, ongoing | No standard; read like any note |
| YAML frontmatter | Cheap selection (`rg` on properties); small per-note overhead | High if schema is rich; no native bulk edit | No; needs grep/Obsidian search |
| GitHub code search + raw | Cheap triage + full-file fetch on demand | Zero (GitHub indexes) | Via `gh` / API (auth); raw GETs unauthenticated |
| ripgrep-friendly structure | Lowest per-query: matching lines only | Naming discipline on every note | No; needs shell access |
| Atomic notes | Pay per concept, not per document | Titling + dense linking discipline | No; amplifies the other conventions |

**Best token-efficiency per unit of upkeep, for this repo:**

1. **ripgrep-friendly structure + atomic notes with descriptive titles** — the
   cheapest agent queries (one grep, one small file read) for a distributed,
   habit-level human cost. These two compound: atomic notes make filenames a
   precision index.
2. **A single root index file** (`llms.txt`-shaped, or a Home MOC) — one
   curated file gives remote/no-clone agents a hub for near-zero marginal
   upkeep beyond link-list maintenance.
3. **`AGENTS.md`/CLAUDE.md carrying navigation rules** — auto-injected, so it
   costs the agent nothing to learn "grep first, start at the index."
4. **Minimal frontmatter** (`tags`, `status` only) — cheap property filters
   without the database-maintenance burden.
5. **GitHub code search + raw fetching** — the right *remote* path (public repo:
   unauthenticated raw GETs work; search needs auth), not a substitute for
   local structure.

## Sources

- https://llmstxt.org/
- https://agents.md/
- https://raw.githubusercontent.com/agentsmd/agents.md/main/README.md
- https://notes.linkingyourthinking.com/Cards/MOCs+Overview
- https://help.obsidian.md/properties
- https://help.obsidian.md/plugins/search
- https://docs.github.com/en/search-github/github-code-search/about-github-code-search
- https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax
- https://docs.github.com/en/rest/search/search#search-code
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- https://docs.github.com/en/rest/repos/contents#get-repository-content
- https://cli.github.com/manual/gh_search_code
- https://raw.githubusercontent.com/BurntSushi/ripgrep/master/README.md
- https://raw.githubusercontent.com/BurntSushi/ripgrep/master/GUIDE.md
- https://notes.andymatuschak.org/z4Rrmh17vMBbauEGnFPTZSK3UmdsGExLRfZz1
