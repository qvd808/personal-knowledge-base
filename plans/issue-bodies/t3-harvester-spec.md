## Question

Write the build-ready spec for `tools/resource-harvester/`, resolving what charting left open:

- Pattern registry interface; v1 matchers: inline `[t](https://…)` and reference-style `[id]: <url>`, scoped to a note's `## Resources` section only.
- Membership scan: raw URLs + existing `[[resources#…]]` wikilinks both count; deletion semantics; malformed-link and duplicate-URL-across-notes handling.
- Rewrite mechanics (bodies mutate inside `## Resources` only) and the `resources.md` renderer: tag sections, per-section URL dedupe, grep-friendly reference list, BEGIN/END GENERATED splice contract mirroring index-generator.
- Determinism: byte-identical re-runs.
- Wrapper wiring: step placement (post-fill, pre-lint), `StepName`, `STEP_SCRIPTS`, package.json script, machine/shell test updates.
