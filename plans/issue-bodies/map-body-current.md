## Destination

A locked spec set that lets one code-mode session build, without further decisions: (1) the resource harvester — `## Resources` links harvested, rewritten to resource wikilinks, `resources.md` auto-populated per topic tag; (2) the diff-gated change-review workflow with an offline grammar checker.

## Notes

Domain: Obsidian vault + local Node toolchain. Conventions: `AGENTS.md`, `ARCHITECTURE.md` (sync steps glue→fill→lint→index; wikilinks internal / Markdown external; kebab-case; Windows-first; all-local preferred). Glossary: `CONTEXT.md`. Sessions consult: caveman (output style), domain-modeling (glossary upkeep), grilling (HITL tickets). Tracker ops: `docs/agents/issue-tracker.md`.

Locked at charting (2026-08-24):

- Harvest scope: links inside a note's `## Resources` section only; extensible pattern registry, first match wins; v1 patterns = inline `[t](url)` + reference-style `[id]: <url>`.
- Bodies are rewritten each sync: harvested links become `[[resources#^<id>|title]]`; anchors are deterministic block ids derived from the URL — pending Quartz research, heading-level fallback if unsupported.
- `resources.md`: one `## <tag>` Topic section per tag in the union of contributing notes' tags (auto taxonomy); a Resource appears under every tag of its note; dedupe by URL within a section; grep-friendly reference list kept.
- Membership stateless and body-derived: raw URLs + existing resource wikilinks both count; deletion = delete the line; no hidden state.
- Grammar check: offline, deterministic, dictionary + swap heuristics (udpate/update, Galina/Gallina), report-only, never blocks push, never edits.
- Trigger: steps stay in the existing sync sequence; change-review alone is internally gated on `git diff` over `knowledge/*.md`, excluding generated files; harvest runs unconditionally every sync _(amended by #38)_.
- Verification agent (fetch + classify website/pdf/youtube + compare note vs source): manual agent sessions when it lands, outside the sync wrapper _(graduated from fog to a ticket when #38 closed)_.

_(Anchor strategy amended by #37: block ids only, fallback dropped — see Decisions so far.)_

_(Destination amended 2026-08-24 by @qvd808: the spec set is locked, so **execution rides the map** — [Build the resource harvester](https://github.com/qvd808/personal-knowledge-base/issues/43), [Build the change-review step](https://github.com/qvd808/personal-knowledge-base/issues/44), and [Author the verify-resources skill](https://github.com/qvd808/personal-knowledge-base/issues/42) are `wayfinder:task` children resolved in that order; no further decisions are expected from the owner.)_

## Decisions so far

<!-- one line per closed ticket -->

- [Does Quartz render Obsidian block references?](https://github.com/qvd808/personal-knowledge-base/issues/36): Partially — scrolling works only for all-lowercase ids (Quartz slugifies link anchors to lowercase while DOM ids keep their case; upstream #2225 unfixed on v4); markers stay invisible; inline list-item ids work → harvester mints explicit lowercase kebab block ids.
- [Lock the anchor strategy for resource wikilinks](https://github.com/qvd808/personal-knowledge-base/issues/37): Block ids only, no heading fallback — `[[resources#^res-<8-hex SHA-256 of verbatim URL>|original text]]`; one anchored registry line per Resource in the reference list (tag sections are plain views); loud-fail on hash collision; report-only vault-lint rule requires every resource wikilink to resolve.
- [Spec the resource harvester module](https://github.com/qvd808/personal-knowledge-base/issues/38): Build-ready spec — strict section-scoped harvest (inline + reference-style, definitions deleted after rewrite), rewrite to `[[resources#^res-<id>|original text]]`, registry persisted inside the generated markers as the sole id↔URL memory (wikilinks sustain their lines); harvester loud-fails only on output integrity (hash collision, unbalanced markers, sustained id missing from registry) while input quality moves to a new report-only lint findings tier (line shape, non-URL targets, orphan definitions, tagless declaring notes); rendering = tag sections alphabetical by tag with `[title](<URL>)` entries + URL-sorted `## References` registry; step `harvest` runs unconditionally fill→harvest→lint→index.

- [Migrate existing links into the harvester model](https://github.com/qvd808/personal-knowledge-base/issues/39): Vault migrated by hand to the #38 harvester model — FPGA prose links into `## Resources` (FIFO redirect URL swapped for the Cummings SNUG2002SJ PDF), both hand-curated entries re-declared by notes, six links rewritten to `[[resources#^res-<sha256-8hex>|original text]]`, resources.md rebuilt inside generated markers; lint clean, 148/148 tests pass; this state is the future build's byte-identical idempotence baseline.

- [Spec the diff-gated change-review workflow](https://github.com/qvd808/personal-knowledge-base/issues/40): Build-ready spec — wrapper step `review` after `index`; diff-gated vs `HEAD` plus untracked notes; checks only added lines via `-U0` hunk parsing; detection = explicit swap pairs (seeded udpate/update, intergraded/integrated, Galina/Gallina) against an exemption wordlist at `tools/change-review/wordlist.txt` (`wrong->right` lines = pairs, other lines = exempt words); prose-only scope (frontmatter, code fences/spans, URLs, wikilink targets/ids, image syntax, block ids skipped — alias text checked); findings print lint-style and the count rides the halt message; exits non-zero only on infrastructure failure.

- [Spec the verification agent](https://github.com/qvd808/personal-knowledge-base/issues/41): Design spec — manual agent sessions driven by a canonical `verify-resources` skill; URL-pattern classification (youtube/pdf/website) with YouTube grouped by video id and verified once; tiered fidelity (existence+topic always, claim-level on extractable text, transcript-level for YouTube via required yt-dlp, `unverifiable (tool missing)` otherwise); LLM judgment yields per-Resource verdicts ok/dead/drift/unsupported-claim/misattribution/unverifiable with quoted evidence both sides; gitignored per-run report `.cache/verification/report-<date>.md` + chat summary, separate from lint's sync-time tier; registry, wrapper, and lint untouched.

- [Build the resource harvester](https://github.com/qvd808/personal-knowledge-base/issues/43): Executed the #38 spec — `tools/resource-harvester/` (`patterns.ts`, `ids.ts`, `render.ts`, `harvest.ts` CLI) plus wrapper step `harvest` wired fill→harvest→lint (`StepName`, phase, `STEP_SCRIPTS`, npm script, transition tests); 29 module tests, 177/177 repo-wide; `npm run harvest` idempotent on the real vault (6 Resources; the one-time diff corrected a tag-sort slip in the hand migration); lint clean.

- [Build the change-review step](https://github.com/qvd808/personal-knowledge-base/issues/44): Executed the #40 spec — `tools/change-review/` (`wordlist.ts`, `diff.ts`, `check.ts`, `review.ts` CLI, seeded `wordlist.txt`) plus wrapper step `review` wired index→review→prompt with the findings count riding the halt message; added-lines-only via `-U0` hunks + untracked notes; 6 module tests incl. real-git end-to-end, 183/183 repo-wide; findings exit 0, infra failures exit 1.

- [Author the verify-resources skill](https://github.com/qvd808/personal-knowledge-base/issues/42): Executed the #41 design — `.agents/skills/verify-resources/SKILL.md` encodes classification (YouTube grouped by video id), tiered fidelity with yt-dlp transcripts and the `unverifiable (tool missing)` posture, six-verdict findings with quoted evidence, gitignored per-run report + chat summary, citation contract and never-edit rules; glue regenerated, `npm run glue:check` clean.

## Not yet specified

- LLM-assisted grammar layer on top of the offline checker.
- New harvest Patterns (bare URLs, citekeys) as they earn a place.
- Noise policy for the auto tag taxonomy (unsorted bucket) if it sprawls.
- Quartz v5 upgrade of the vendored site build: re-pin, re-verify block-ref navigation (the v4 slug bug may be fixed upstream), re-run site-build checks. Surfaces once v5 stabilizes.
- URL canonicalization policy (trailing slashes, tracking params) if verbatim-URL identity proves too strict in practice.

## Out of scope

- (none yet)
