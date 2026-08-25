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
- Trigger: steps stay in the existing sync sequence, internally gated on `git diff` over `knowledge/*.md`, excluding generated files.
- Verification agent (fetch + classify website/pdf/youtube + compare note vs source) is fog, not tickets; manual agent sessions when it lands.

_(Anchor strategy amended by #37: block ids only, fallback dropped — see Decisions so far.)_

## Decisions so far

<!-- one line per closed ticket -->

- [Does Quartz render Obsidian block references?](https://github.com/qvd808/personal-knowledge-base/issues/36): Partially — scrolling works only for all-lowercase ids (Quartz slugifies link anchors to lowercase while DOM ids keep their case; upstream #2225 unfixed on v4); markers stay invisible; inline list-item ids work → harvester mints explicit lowercase kebab block ids.
- [Lock the anchor strategy for resource wikilinks](https://github.com/qvd808/personal-knowledge-base/issues/37): Block ids only, no heading fallback — `[[resources#^res-<8-hex SHA-256 of verbatim URL>|original text]]`; one anchored registry line per Resource in the reference list (tag sections are plain views); loud-fail on hash collision; report-only vault-lint rule requires every resource wikilink to resolve.

## Not yet specified

- Verification agent design: classification rules, fetch strategy, note-vs-source fidelity comparison, findings surface. Graduates after the harvester spec closes.
- LLM-assisted grammar layer on top of the offline checker.
- New harvest Patterns (bare URLs, citekeys) as they earn a place.
- Noise policy for the auto tag taxonomy (unsorted bucket) if it sprawls.
- Quartz v5 upgrade of the vendored site build: re-pin, re-verify block-ref navigation (the v4 slug bug may be fixed upstream), re-run site-build checks. Surfaces once v5 stabilizes.
- URL canonicalization policy (trailing slashes, tracking params) if verbatim-URL identity proves too strict in practice.

## Out of scope

- (none yet)
