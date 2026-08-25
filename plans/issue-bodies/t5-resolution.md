Decision recorded for **Spec the diff-gated change-review workflow** (grilling, HITL — answered live by @qvd808).

## Resolution — build-ready spec for `tools/change-review/`

### 1. Scope and trigger

- One wrapper step, `review`, runs **after `index`, before `prompt`** — genuinely sync-end.
- Changed set = tracked notes under `knowledge/` that differ from `HEAD` (`git diff --name-only HEAD -- knowledge/`) **plus** untracked note files (`git ls-files --others --exclude-standard`, filtered to vault notes). No log-grepping for a "last sync commit": no obsidian-git plugin exists, so `HEAD` is always the last sync commit.
- Note classification reuses `scanVault` (`tools/lib/vault.ts`): `.md` minus `images/`, `Excalidraw/`, `templates/`, dot-paths. Generated `index.md` and `resources.md` are always excluded.
- Zero changed notes → print `change-review: no changed notes`, exit 0.

### 2. Added-lines extraction (Q2)

- Tracked notes: `git diff -U0 HEAD -- <file>`; parse `@@ -a,b +c,d @@` hunk headers; the added ranges are `c..c+d-1` on the new-file side (`d = 0` is a pure deletion — nothing to check).
- Untracked notes: every line counts as added.
- Detectors see **only those lines**; findings carry true worktree line numbers. Untouched lines are never re-reported — a pre-existing typo stays silent until its line changes.

### 3. Detection rules (v1) (Q3)

- Active detection = **swap pairs**: explicit `wrong->right` pairs, matched whole-word and case-insensitively; the finding reports the original token.
- Seed pairs: `udpate->update`, `intergraded->integrated`, `Galina->Gallina`.
- No unknown-word flagging of any kind. The "dictionary" is the exemption wordlist (§4) only. The LLM-assisted grammar layer stays fog on the map.

### 4. Wordlist file (Q4)

- `tools/change-review/wordlist.txt`: UTF-8, one entry per line, `#` comments, blank lines ignored, sorted.
- A line containing `->` is a swap pair; every other non-comment line is an exempt word (never suspicious).
- Growth process: edit the file directly, in any session. No UI, no JSON config.
- Parse errors (empty side of a pair, duplicate pair with conflicting right side) are infrastructure failures → exit 1.

### 5. Exemptions — text never checked (Q5)

Principle: **check what readers see; never touch what machines address.**

Skipped: YAML frontmatter; fenced code blocks; inline code spans; URLs; resource-wikilink target/id parts (`[[resources#^res-…|alias]]` — the alias text **is** checked); image/embed and link syntax; trailing block ids (`^id`).

Checked: headings, paragraphs, list items, table cells, wikilink alias text — all other body prose.

### 6. Output and exit posture (Q6)

- Each finding prints lint-style: `<file>:<line> [swap] '<wrong>' -> '<right>'`.
- Run summary: `change-review: N finding(s)` / `change-review: no findings`.
- Wrapper appends the count to the final halt message: `Sync complete. N findings.` No modal dialog, no report file.
- Exit code: **0 whenever the run completes**, findings or not. Non-zero only on infrastructure failure: git command failure, unreadable file, wordlist parse error. Findings never block the push and never edit bodies (glossary: *Finding*).

### 7. Wrapper wiring (Q7)

- `StepName` gains `"review"`; phase `"review"` sits between `"index"` and `"prompt"`; `step-done` transitions become `index → review → prompt`; `stepLabel` → `Change review`.
- `STEP_SCRIPTS.review = "tools/change-review/review.ts"`; package.json script `"review": "tsx tools/change-review/review.ts"`.
- Machine tests gain the `index → review` and `review → prompt` transitions plus the review infra-failure path.

### 8. Module layout and CLI

- `tools/change-review/`: `review.ts` (CLI + `run()`), `diff.ts` (changed-set assembly + hunk parsing), `check.ts` (region masking + detectors), `wordlist.ts` (parse/validate), `errors.ts`, `test/`.
- CLI mirrors the other modules: `tsx tools/change-review/review.ts [vault-root]` (default `knowledge`); usage errors exit 2; expected failures exit 1 with `change-review: <message>`; git runs with `cwd = repoRoot`.

### 9. Test plan

Unit: hunk-header parsing (added ranges, pure deletions, multi-hunk union, new-file hunks), changed-set assembly (tracked + untracked, generated files excluded), exemption masking (each §5 region, alias-text exception), swap matching (whole-word, case-insensitive, original-token reporting), wordlist parsing and validation failures, byte-determinism of output. Wrapper: transition tests + infra-failure path. All local, no network.

---

Follow-ups applied: glossary updated (*Change review* sharpened to added-lines-only; *Swap pair* and *Wordlist* added); map decision line appended; no fog graduated (LLM grammar layer deliberately stays unspecified).
