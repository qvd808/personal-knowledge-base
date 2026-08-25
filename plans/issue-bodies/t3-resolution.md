Decision recorded for **Spec the resource harvester module** (grilling, HITL — answered live by @qvd808).

## Resolution — build-ready spec for `tools/resource-harvester/`

### 1. Scope and inputs

- One run processes every vault note (per `scanVault` classification in `tools/lib/vault.ts`: `.md` files minus `images/`, `Excalidraw/`, `templates/`, dot-paths).
- Only `## Resources` sections are harvested: a line exactly `## Resources` (trimmed) opens one; the next heading of level ≤ 2 closes it. `###` subheadings inside remain part of the section.
- Excluded from the membership scan entirely: `resources.md` and `index.md` — generated files never feed back.
- Inputs: (a) note bodies; (b) the current registry section of `resources.md` (inside the generated markers) as the id→URL memory. There is no other state.

### 2. Pattern registry (v1)

Ordered matchers, first match wins, applied to Resources-section lines only:

1. **Inline**: `[text](https://…)` / `[text](http://…)` — target must parse as an absolute http(s) URL.
2. **Reference usage**: `[text][label]` whose definition `[label]: <URL>` appears later in the **same section** (strict section scoping — Q1b).

A line already in rewritten form `[[resources#^res-…|…]]` feeds the membership scan (§4) and is never re-rewritten. Non-matching lines pass through untouched — never an error (§6).

### 3. Rewrite mechanics

- A matched link becomes `[[resources#^<id>|<original text>]]` where `<id>` = `res-` + first 8 hex chars of SHA-256 of the trimmed verbatim URL (#37). Indentation, list marker, and surrounding text are preserved; only the link token swaps.
- Once every usage of a reference definition is rewritten, the definition line is deleted (mutation stays inside the section).
- Idempotent: re-runs on rewritten bodies change nothing.

### 4. Membership & registry persistence

- Membership = union over notes of {URLs matched by Patterns} ∪ {ids of resource wikilinks found in sections}.
- Registry persistence (Q4): a wikilink-found id **sustains** its registry line via the URL recorded in the current registry. Deleting a note's line deletes its wikilink; when no note sustains an id anymore, its registry line drops on the next run.
- Same URL twice in one note: both lines rewrite to the same id (Q2). Same URL across notes: silently merges onto one registry line (Q3).

### 5. Rendering `resources.md`

- Splice contract identical to the index generator (`tools/index-generator/section.ts`): content outside `<!-- BEGIN GENERATED -->` / `<!-- END GENERATED -->` preserved byte-for-byte; missing markers → section appended (self-heal); unbalanced markers → loud fail.
- Generated content, in order:
  - **Topic sections**: one `## <tag>` per tag in the union of contributing notes' frontmatter tags, sorted alphabetically by tag. Entries: `- [original title](<URL>)`, sorted alphabetically by title; dedupe by URL within a section; title conflict (same URL from two notes) → the title from the alphabetically-first note basename wins (Q5).
  - **`## References`**: one line per Resource, `- <URL> ^res-xxxxxxxx`, sorted by URL; the `^id` marker sits inline at line end (the placement Quartz demonstrably anchors). This list is the sole link target — no anchors anywhere else.
- Determinism: byte-identical re-runs; all sort orders total; no timestamps or counts anywhere.

### 6. Failure posture

The harvester loud-fails (non-zero exit; wrapper stops the sync) **only on output integrity**:

- SHA-256 8-hex collision between two distinct URLs;
- unbalanced generated markers in `resources.md`;
- a sustained id (wikilink found in a note) absent from the current registry — guards against hand-deleted registry lines.

Everything else is **input quality** → left untouched, reported by lint (Q2/Q6): broken syntax, non-URL targets, `|`/`]]` aliases, orphan definitions, tagless declaring notes.

### 7. Vault-lint changes

Lint gains a two-tier result (`tools/vault-lint/lint.ts` today fails on ANY violation): `violations` (blocking, unchanged semantics) vs `findings` (printed, never affect the exit code). New report-only findings:

- `resources-shape` — a line inside `## Resources` is neither a resource wikilink nor a well-formed v1-pattern link (catches broken syntax and `|`/`]]` aliases);
- `resources-url` — a Resources-section link target is not an absolute http(s) URL;
- `resources-orphan-def` — a reference definition in the section with no usage in the same section;
- `resources-untagged` — a note declares ≥ 1 Resource but frontmatter `tags` is empty or missing;
- `resource-anchor` — #37's locked rule: every `[[resources#^…]]` resolves against the current registry.

### 8. Wrapper wiring

- `StepName` gains `"harvest"`; step order glue → fill → **harvest** → lint → index; phase `"harvest"` between `fill` and `lint`; `stepLabel` → "Resource harvester".
- `STEP_SCRIPTS.harvest = "tools/resource-harvester/harvest.ts"`; package.json script `"harvest": "tsx tools/resource-harvester/harvest.ts"`; machine tests gain the fill→harvest and harvest→lint transitions.
- Runs **unconditionally** every sync (Q7) — no diff gate; the git-diff trigger scopes to change-review only (#40).

### 9. Module layout & CLI

- `tools/resource-harvester/`: `harvest.ts` (CLI + `run()`), `patterns.ts`, `ids.ts`, `render.ts`, `errors.ts`, `test/`.
- CLI mirrors the index generator: `tsx tools/resource-harvester/harvest.ts [vault-root]` (default `knowledge`); usage errors exit 2; expected failures exit 1 with `harvest: <message>`; success prints a regenerated/up-to-date line including the Resource count.

### 10. Test plan

Unit: pattern matching (both forms, section scoping, non-URL rejection), id derivation vectors, rewrite idempotence, membership union + sustaining, renderer sort/dedupe/title-conflict rules, splice self-heal/unbalanced, collision and missing-sustained-id failures. Wrapper: transition tests. All local, no network.

---

Follow-ups applied: glossary updated (*Finding* / *Violation* added, *Harvesting* sharpened with registry-as-memory); map updated (decision line, trigger-line amendment, verification-agent fog graduated to a fresh ticket).
