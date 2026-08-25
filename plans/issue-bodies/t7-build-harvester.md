Part of #35

## Question

Nothing to decide — execute [Spec the resource harvester module](https://github.com/qvd808/personal-knowledge-base/issues/38)'s build-ready spec end to end:

- `tools/resource-harvester/`: `harvest.ts` (CLI + `run()`), `patterns.ts`, `ids.ts`, `render.ts`, `errors.ts`, `test/` — section-scoped harvest (inline + reference-style, definitions deleted after rewrite), rewrite to `[[resources#^res-<sha256-8hex>|original text]]`, registry persisted inside generated markers, tag-section rendering + URL-sorted `## References`, splice contract mirroring index-generator, loud-fail only on output integrity.
- Wrapper wiring: `StepName` gains `"harvest"` (fill→harvest→lint→index), phase, `stepLabel`, `STEP_SCRIPTS.harvest`, package.json `"harvest"` script, machine transition tests.
- Runs unconditionally every sync.

**Acceptance**: full test suite passes; running `npm run harvest` on `knowledge/` produces a **zero diff** (the hand-migrated state from [Migrate existing links into the harvester model](https://github.com/qvd808/personal-knowledge-base/issues/39) is the byte-identical idempotence baseline); `npm run lint:vault` clean.
