Decision recorded from #37 — **Lock the anchor strategy for resource wikilinks**

Block ids only, heading-level fallback dropped: rewritten links are `[[resources#^res-<id>|original text]]` where `<id>` = `res-` + first 8 hex of SHA-256 of the verbatim trimmed URL. Exactly one anchored line per Resource — the id↔URL **registry** — lives in the reference list at the bottom of `resources.md`; tag sections become plain anchor-free views. Hash collisions fail the sync loudly; membership is self-healing, and [`vault-lint`](https://github.com/qvd808/personal-knowledge-base/blob/main/tools/vault-lint/lint.ts) gains a report-only rule requiring every resource wikilink to resolve against the registry. No v4-specific engineering; forward-compatible with Quartz v5.

Full resolution: #37 · ticket closed: #37 · this map's "Decisions so far" section updated (+ new fog: Quartz v5 upgrade, URL canonicalization policy).
