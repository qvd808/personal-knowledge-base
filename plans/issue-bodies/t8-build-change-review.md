Part of #35

## Question

Nothing to decide — execute [Spec the diff-gated change-review workflow](https://github.com/qvd808/personal-knowledge-base/issues/40)'s build-ready spec end to end:

- `tools/change-review/`: `review.ts` (CLI + `run()`), `diff.ts` (changed-set = `git diff --name-only HEAD -- knowledge/` ∪ untracked notes; `-U0` hunk parsing → added-line ranges), `check.ts` (exemption masking + swap-pair detectors), `wordlist.ts` (parse/validate), `errors.ts`, `test/`.
- `tools/change-review/wordlist.txt`: seeded pairs `udpate->update`, `intergraded->integrated`, `Galina->Gallina`; `#` comments; sorted.
- Findings print `<file>:<line> [swap] '<wrong>' -> '<right>'`; summary `change-review: N finding(s)`; exit 0 on completed runs, non-zero only on infrastructure failure (git errors, unreadable file, wordlist parse error).
- Wrapper wiring: `StepName` gains `"review"` after `"index"` (index→review→prompt), phase, `stepLabel` "Change review", `STEP_SCRIPTS.review`, package.json `"review"` script, machine transition + infra-failure tests.

**Acceptance**: full test suite passes; seeded pairs fire on fixture lines and stay silent on exempted regions (frontmatter, fences, spans, URLs, wikilink targets, block ids); untouched lines never re-report; findings exit 0.
