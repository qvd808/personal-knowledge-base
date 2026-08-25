Part of #35

## Question

Nothing to decide — execute [Spec the verification agent](https://github.com/qvd808/personal-knowledge-base/issues/41)'s design spec:

- Author `.agents/skills/verify-resources/SKILL.md` (canonical store format per #10: portable frontmatter — `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) encoding the full procedure: enumerate Resources from the `resources.md` registry → classify by URL pattern (youtube / pdf / website) → group YouTube by video id, verified once → fetch/cache under gitignored `.cache/verification/<res-id>/` (yt-dlp required for transcripts; missing tool ⇒ `unverifiable (tool missing)` + install hint) → judge fidelity per class promise → report verdicts `ok` / `dead` / `drift` / `unsupported-claim` / `misattribution` / `unverifiable`, each non-ok quoting evidence from both sides → write `.cache/verification/report-<date>.md` + chat summary.
- Skill carries the citation contract and the never-edit rule; default scope = all notes with `## Resources`, narrowable on request.
- Regenerate glue (`npm run glue`) so `.claude/` wrappers pick the skill up; committed glue must match regeneration.

**Acceptance**: skill present in canonical store + generated glue; a dry-run of the procedure against the vault's six Resources produces a well-formed report (fetches may be skipped/mocked offline — structure is what's accepted); `npm run glue:check` clean.
