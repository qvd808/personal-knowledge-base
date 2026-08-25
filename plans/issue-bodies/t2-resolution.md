Decision recorded for **Lock the anchor strategy for resource wikilinks** (grilling, HITL — answered live by @qvd808).

## Resolution

1. **Strategy — block ids only.** Rewritten links take the form `[[resources#^<id>|…]]`; the heading-level fallback charted as a contingency is dropped. Grounds: the [Quartz block-ref research](https://github.com/qvd808/personal-knowledge-base/blob/main/docs/research/quartz-block-refs.md) (#36) shows stock v4 navigates block refs end-to-end given lowercase ids — which we mint ourselves — so nothing is engineered against v4 quirks, and the scheme is forward-compatible with Quartz v5.
2. **Id derivation.** `<id>` = `res-` + first 8 hex chars of SHA-256 of the trimmed Resource URL, taken **verbatim** (no host lowercasing, no tracking-param stripping in v1). Deterministic-from-URL, per the glossary. Collision posture is **loud failure**: the harvester errors the sync rather than silently mislinking.
3. **Anchor placement — single registry line.** Exactly one anchored line per Resource, living in the grep-friendly reference list at the bottom of `resources.md`; that line is the id↔URL **registry** and the sole link target. Tag sections become plain views without anchors — no duplicate DOM ids (Quartz duplicate ids silently first-win). The marker sits inline at the end of the registry bullet, the placement Quartz demonstrably attaches ids to.
4. **Alias form.** The author's original link text is preserved verbatim: `[[resources#^res-0a1b2c3d|their text]]`.
5. **Stale anchors.** Membership is self-healing — an existing `[[resources#^<id>]]` wikilink itself sustains its registry line, so a target cannot silently vanish while a link to it exists. The residual risk (typo'd or hand-mangled ids pointing nowhere) gets a **report-only vault-lint rule**: every `[[resources#^…]]` must resolve against the current registry. The harvester spec (#38) integrates this rule.

Consequences accepted: verbatim URLs mean trailing-slash variants count as distinct Resources (canonicalization stays fog until it earns a place).

Follow-ups applied: glossary updated (*Resource wikilink* sharpened, *Reference list* added); map updated (decision line; new fog: Quartz v5 upgrade of the vendored build, URL canonicalization policy).
