# Wayfinder map draft — resources auto-population + change review

Everything below is ready to paste into GitHub issues. Creation needs `gh`
(shell lives outside architect mode), so commands are bundled at the bottom.

---

## MAP BODY (label: `wayfinder:map`)

Title: `Wayfinder: resources auto-population and change review`

```markdown
## Destination

A locked spec set that lets one code-mode session build, without further
decisions: (1) the resource harvester — `## Resources` links harvested,
rewritten to resource wikilinks, `resources.md` auto-populated per topic tag;
(2) the diff-gated change-review workflow with an offline grammar checker.

## Notes

Domain: Obsidian vault + local Node toolchain. Conventions: `AGENTS.md`,
`ARCHITECTURE.md` (sync steps glue→fill→lint→index; wikilinks internal /
Markdown external; kebab-case; Windows-first; all-local preferred). Glossary:
`CONTEXT.md`. Sessions consult: caveman (output style), domain-modeling
(glossary upkeep), grilling (HITL tickets). Tracker ops: `docs/agents/issue-tracker.md`.

Locked at charting (2026-08-24):

- Harvest scope: links inside a note's `## Resources` section only; extensible
  pattern registry, first match wins; v1 patterns = inline `[t](url)` +
  reference-style `[id]: <url>`.
- Bodies are rewritten each sync: harvested links become
  `[[resources#^<id>|title]]`; anchors are deterministic block ids derived from
  the URL — pending Quartz research, heading-level fallback if unsupported.
- `resources.md`: one `## <tag>` Topic section per tag in the union of
  contributing notes' tags (auto taxonomy); a Resource appears under every tag
  of its note; dedupe by URL within a section; grep-friendly reference list kept.
- Membership stateless and body-derived: raw URLs + existing resource
  wikilinks both count; deletion = delete the line; no hidden state.
- Grammar check: offline, deterministic, dictionary + swap heuristics
  (udpate/update, Galina/Gallina), report-only, never blocks push, never edits.
- Trigger: steps stay in the existing sync sequence, internally gated on
  `git diff` over `knowledge/*.md`, excluding generated files.
- Verification agent (fetch + classify website/pdf/youtube + compare note vs
  source) is fog, not tickets; manual agent sessions when it lands.

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- Verification agent design: classification rules, fetch strategy, note-vs-
  source fidelity comparison, findings surface. Graduates after the harvester
  spec (T3) closes.
- LLM-assisted grammar layer on top of the offline checker.
- New harvest Patterns (bare URLs, citekeys) as they earn a place.
- Noise policy for the auto tag taxonomy (unsorted bucket) if it sprawls.

## Out of scope

- (none yet)
```

---

## TICKETS (children of the map)

### T1 — research — unblocked

Title: `Does Quartz render Obsidian block references?`
Labels: `wayfinder:research`

```markdown
Part of #<MAP>

## Question

The vendored Quartz v4 site build (`vendor/quartz/`, pinned per
ARCHITECTURE.md #12) must render the harvester's output. Verify against
primary sources (Quartz docs/source, Obsidian help):

1. Does `[[note#^block-id]]` resolve and scroll to the exact block on the
   rendered site?
2. Do `^id` markers stay invisible in rendered pages?
3. Any known gaps for block ids on list items (our Resource lines are list items)?

Findings decide the anchor strategy ticket (block ids preferred, heading-level
fallback). Capture findings in a research notes file; branch
`research/quartz-block-refs`; comment the gist here.
```

### T2 — grilling — blocked by T1

Title: `Lock the anchor strategy for resource wikilinks`
Labels: `wayfinder:grilling`

```markdown
Part of #<MAP>

## Question

Given T1's Quartz findings: block ids (`[[resources#^<id>]]`) or heading-level
(`[[resources#<tag>]]`)? Then settle: id derivation (hash algorithm + length),
alias/display form, and URL-change behavior (new URL = new id — who cleans the
orphaned old line?).
```

### T3 — grilling — blocked by T2

Title: `Spec the resource harvester module`
Labels: `wayfinder:grilling`

```markdown
Part of #<MAP>

## Question

Write the build-ready spec for `tools/resource-harvester/`, resolving what
charting left open:

- Pattern registry interface; v1 matchers: inline `[t](https://…)` and
  reference-style `[id]: <url>`, scoped to `## Resources`.
- Membership scan: raw URLs + existing `[[resources#…]]` wikilinks; deletion
  semantics; malformed-link and duplicate-URL-across-notes handling.
- Rewrite mechanics (bodies mutate inside `## Resources` only) and the
  `resources.md` renderer (tag sections, per-section URL dedupe, reference
  list, BEGIN/END GENERATED splice contract mirroring index-generator).
- Determinism: byte-identical re-runs.
- Wrapper wiring: step placement (post-fill, pre-lint), `StepName`,
  `STEP_SCRIPTS`, package.json script, machine/shell test updates.
```

### T4 — task — blocked by T3

Title: `Migrate existing links into the harvester model`
Labels: `wayfinder:task`

```markdown
Part of #<MAP>

## Question

Nothing to decide — work that unblocks the first real sync:

- Move FPGA prose resource-links (APIO repo, metastability experiment, FIFO)
  into `## Resources`; replace the FIFO YouTube-redirect URL with the real
  Cummings SNUG2002SJ FIFO1 PDF.
- Absorb the two hand-curated `resources.md` entries into the generated model.
- Add generated-section markers; run the first rewrite pass; eyeball the diff.
```

### T5 — grilling — unblocked

Title: `Spec the diff-gated change-review workflow`
Labels: `wayfinder:grilling`

```markdown
Part of #<MAP>

## Question

Write the build-ready spec for the change-review step, independent of the
harvester:

- Change detection: diff base (HEAD vs worktree? last commit?), filter to
  `knowledge/*.md`, exclude generated `index.md` / `resources.md`.
- Hunk extraction feeding both the grammar check and (later) harvest triggers.
- Offline grammar checker: dictionary + swap heuristics (udpate/update,
  intergraded/integrated, Galina/Gallina); custom wordlist location and growth
  process; proper-noun/code-fence exemptions.
- Report-only output channel at sync end; never blocks push; never edits.
- Step placement in the wrapper state machine + tests.
```

---

## GH COMMAND SCRIPT (run in code mode)

```bash
# labels (ignore "already exists" errors)
gh label create "wayfinder:map" --color 5319E7
gh label create "wayfinder:research" --color 1D76DB
gh label create "wayfinder:grilling" --color D93F0B
gh label create "wayfinder:task" --color 0E8A16

# map
gh issue create --label wayfinder:map --title "Wayfinder: resources auto-population and change review" --body-file <map-body.md>
MAP=<number>

# tickets (bodies start with "Part of #<MAP>" — substitute before create)
gh issue create --label wayfinder:research --title "..." --body-file <t1.md>
gh issue create --label wayfinder:grilling --title "..." --body-file <t2.md>
gh issue create --label wayfinder:task     --title "..." --body-file <t4.md>
gh issue create --label wayfinder:grilling --title "..." --body-file <t5.md>
gh issue create --label wayfinder:grilling --title "..." --body-file <t3.md>

# attach as sub-issues of the map (sub-issues endpoint; see docs/agents/issue-tracker.md)
# gh api --method POST repos/qvd808/personal-knowledge-base/issues/<MAP>/sub_issues -F sub_issue_id=<child-db-id>

# blocking edges (native dependencies; database ids, not #numbers)
# T2 blocked_by T1; T3 blocked_by T2; T4 blocked_by T3
# gh api --method POST repos/qvd808/personal-knowledge-base/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>

# fire research subagent for T1 (new_task, code mode, research skill, branch research/quartz-block-refs)
```
