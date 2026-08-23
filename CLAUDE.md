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
`domain-modeling`, `prototype`, `research` — live under `.claude/skills/` and are invoked
by the Skill tool.

## Modes

Output styles beyond the default, under `.claude/output-styles/`:

- `/output-style caveman` — base compression rules.
- `/output-style caveman-research` — papers, experiments, claims discipline.
- `/output-style caveman-code` — review and advice, read-only posture.

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

### Once approved

- Re-read every file immediately before writing to it. I edit these files too, sometimes
  while you are working. Never write based on a copy you read earlier in the conversation.
- Make only the approved change. Mention anything else you notice; do not fix it.
- Leave changes uncommitted in the working tree. I do the commits, and I do not want a
  Claude co-author trailer.
- Never run `git checkout`, `git restore`, `git reset`, `git clean`, or `git stash` to
  discard working-tree changes. Uncommitted work in this repo may be mine.