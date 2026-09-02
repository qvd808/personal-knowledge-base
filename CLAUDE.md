# CLAUDE.md

## Project

Personal knowledge base: an Obsidian-based knowledge base, hosted free on GitHub, that
both humans and agents can read, search, and extend. Requirements (from `tasks.txt`):

- Free hosting on GitHub (or an equivalent free tier); no paid services.
- Obsidian-compatible, so the knowledge base can be built up locally.
- A store for agent skills/knowledge that agents can interact with.
- Human-readable and extensible for rendering, while staying token-efficient for agent
  search.
- Local writing syncs with GitHub; the sync architecture must avoid the
  "multiple syncs" curse.
- Static online rendering of both the graph and page content, likely GitHub Pages.
- IDE-independent agent query access: neovim, VS Code, claude.com, ChatGPT, Gemini.

## Agent skills

### Issue tracker

Issues and specs for this repo live as GitHub issues, driven by the `gh` CLI.
See `docs/agents/issue-tracker.md`. The tracker doc infers the repo from `git remote -v`,
so it works once this repo has a remote.

### Wayfinder

`/wayfinder` plans a large, foggy chunk of work as a shared map of decision tickets on the
issue tracker above, and resolves them one at a time. Its companion skills — `grilling`,
`domain-modeling`, `prototype`, `research` — live under `.agents/skills/` (the canonical
store; `.claude/skills/` holds generated glue) and are invoked by the Skill tool.

### Knowledge notes

`knowledge-note` writes and revises the explanation notes under `docs/knowledge/`, ordering
each note by its dependency graph so every term is defined before it is used. It is the one
skill with a standing write grant; see "The one standing exception" below for its limits.

## Sources and citations

These apply to everything an agent writes here — knowledge notes, research files, issue
bodies, and answers in chat.

- Every factual claim carries the URL actually fetched, plus the work's title and its
  identifier: a DOI, an arXiv id, an RFC number, a version tag, whatever the work has.
- A source that could not be fetched is reported as unfetched, in those words. It is never
  cited from memory and never paraphrased as though it had been read.
- Anything worked out rather than read is marked as inferred, in that word.
- Every path, filename, flag and command carries its `file:line`.

## Modes

Output styles beyond the default, under `.claude/output-styles/`:

- `/output-style caveman` — base compression rules.
- `/output-style caveman-research` — papers, experiments, claims discipline.
- `/output-style caveman-code` — review and advice, read-only posture.

These rules are duplicated in `AGENTS.md` § *Write gate*, for agents that never read this
file — Cursor, Codex, and anything else pointed at `AGENTS.md`. The two must say the same
thing: change one, change the other.

### Read-only is the default

"Review", "check", "look at", "see if", "is there anything wrong with" are analysis
requests. Report what you find in the chat and stop. Do not apply the fixes, not even
obvious or trivial ones.

### Getting approval

- Only EDIT if the words "For the love of everything, please edit, please help me" is send by the user.
- Approval covers only the change described. It does not extend to the next file, the
  next finding, or the next turn.
- Ambiguous wording ("fix it", "sort this out", "can you handle it") is not approval.
  Ask which files you may touch before writing anything.

#### The one standing exception

The `knowledge-note` skill may create and edit files under `docs/knowledge/` without the
phrase above. The grant is narrow and does not widen:

- It covers `docs/knowledge/` and nothing else — not code, not `docs/agents/`, not
  `docs/research/`, not `.agents/skills/`, not this file.
- It applies only while `knowledge-note` is the skill doing the work. Another skill, or no
  skill, writing to `docs/knowledge/` still needs the phrase. Invoking the skill is what
  opens it, and the opening lasts only for the session.
- Deleting a note is never covered. Only creating a note and editing one.
- Everything under "Once approved" still applies inside `docs/knowledge/`, including
  re-reading each file immediately before writing and leaving the result uncommitted.

### Once approved

- Re-read every file immediately before writing to it. I edit these files too, sometimes
  while you are working. Never write based on a copy you read earlier in the conversation.
- Make only the approved change. Mention anything else you notice; do not fix it.
- Leave changes uncommitted in the working tree. I do the commits, and I do not want a
  Claude co-author trailer.
- Never run `git checkout`, `git restore`, `git reset`, `git clean`, or `git stash` to
  discard working-tree changes. Uncommitted work in this repo may be mine.

### The gate is enforced

`tools/write-gate/gate.mjs` runs as a hook on every prompt, every tool call and every
shell command — `.claude/settings.json` here, `.cursor/hooks.json` for Cursor. Approval is
read from my own message, so an agent cannot grant itself the phrase, and it is re-read on
every message, so it never carries into the next turn. Markers live in `.git/write-gate/`,
uncommitted. `npm test` covers the rules; `AGENTS.md` § *The gate is enforced, not merely
asked* states what it blocks and what it cannot.

It gates changes to this repository's content, and nothing else. Running the app, running
tests, reading status, `gh` and the issue tracker, dependency installs, and writes to a
scratchpad outside the repo all pass untouched. `git add`, `commit` and `push` are gated
because I do those myself. The git commands above stay blocked even when approval is
active.