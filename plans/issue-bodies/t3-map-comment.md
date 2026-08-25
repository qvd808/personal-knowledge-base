Decision recorded for **Spec the resource harvester module** (grilling, HITL — answered live by @qvd808).

Full build-ready spec lives on the ticket: #38. Gist:

- **Scope**: strict — only `## Resources` sections (exact heading, closes at the next level ≤ 2 heading); v1 patterns inline + reference-style with definitions deleted after rewrite; `resources.md` / `index.md` never feed the scan.
- **Rewrite**: matches become `[[resources#^res-<8-hex SHA-256 of verbatim URL>|original text]]`; idempotent; duplicate URLs merge silently within and across notes.
- **Persistence**: the registry inside the generated markers is the only memory — wikilink-found ids sustain their lines; a sustained id missing from the registry loud-fails.
- **Posture**: the harvester fails only on output integrity (hash collision, unbalanced markers, missing sustained id); input quality (broken syntax, non-URL targets, pipe aliases, orphan definitions, tagless declaring notes) moves to a **new report-only lint findings tier** — lint today blocks on everything, so the tier itself is part of this build.
- **Rendering**: topic sections alphabetical by tag with `- [title](<URL>)` entries alphabetical by title (conflict → alphabetically-first note basename wins), URL-sorted `## References` registry with inline `^res-` markers; byte-identical re-runs.
- **Wiring**: step `harvest` between fill and lint, unconditional every sync — the git-diff trigger now scopes to change-review only (Notes amended).

Follow-ups applied: glossary updated (*Finding* / *Violation* added, *Harvesting* sharpened with registry-as-memory); verification-agent fog graduated to a fresh ticket; map Notes trigger line tightened.
