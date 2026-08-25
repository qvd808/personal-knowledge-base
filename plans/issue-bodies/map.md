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

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- Verification agent design: classification rules, fetch strategy, note-vs-source fidelity comparison, findings surface. Graduates after the harvester spec closes.
- LLM-assisted grammar layer on top of the offline checker.
- New harvest Patterns (bare URLs, citekeys) as they earn a place.
- Noise policy for the auto tag taxonomy (unsorted bucket) if it sprawls.

## Out of scope

- (none yet)
