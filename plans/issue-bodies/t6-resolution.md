Decision recorded for **Spec the verification agent** (grilling, HITL — answered live by @qvd808).

## Resolution — design spec for the verification agent

### 1. Posture and entry point

- Manual agent sessions only — never part of the sync wrapper; the registry, wrapper steps, and lint rules stay untouched.
- Entry point: a canonical skill, `.agents/skills/verify-resources/SKILL.md`. Skills are this repo's mechanism for driving agent behavior; glue generation already exists, so any IDE agent gets a repeatable procedure.

### 2. Classification (Q1)

- Pure URL patterns, zero network: `youtube.com/watch`, `youtu.be/`, `music.youtube.com` → **youtube**; path ending `.pdf` → **pdf**; everything else → **website**.
- **YouTube source key = extracted video id**: all Resources sharing a video id — any URL spelling (`youtu.be/…?si=…`, `watch?v=…&t=…`), any note — are verified **once** against that video; findings report against every Resource line sharing the id. Verbatim-URL registry identity (#37) is untouched; grouping is verification-time only. pdf/website are keyed by verbatim URL.

### 3. Fidelity promise per class (Q2)

- **website**: resolves after redirects; topic matches the declaring note's usage; claims checked against page prose.
- **pdf**: downloads; text extractable; claims checked against document text (author/title/section level).
- **youtube**: **transcript-level claim checking** (the only viable check, per @qvd808); video availability + title/description as baseline. Auto-generated English captions accepted when no manual track exists.

### 4. Fetch strategy and cache (Q3)

- Agent-driven fetch inside the session (PowerShell `Invoke-WebRequest` / curl); no new dependencies except **yt-dlp**, the designated transcript fetcher (free, standalone Windows exe, no API keys).
- Cache: gitignored `.cache/verification/<res-id>/` at repo root — saved pages, PDF bytes, transcript text. Re-runs skip fresh downloads. Never inside `knowledge/`.
- `yt-dlp` missing at run time → YouTube Resources come back `unverifiable (tool missing)` with an install hint; never silently downgraded.

### 5. Comparison judgment and findings taxonomy (Q4)

Judgment is LLM-based (an agent session), unlike deterministic lint. Per-Resource verdicts:

- `ok` — faithful within the class promise;
- `dead` — unreachable after redirects;
- `drift` — source exists but its topic doesn't match the note's usage;
- `unsupported-claim` — the note asserts something the source doesn't say;
- `misattribution` — wrong author/source credited;
- `unverifiable` — tool missing or text unextractable (reason stated).

Cosmetic title typos are not findings. Every non-`ok` verdict quotes evidence from both sides (citation contract).

### 6. Findings surface (Q5)

- Per-run markdown report at `.cache/verification/report-<date>.md` — gitignored, ephemeral, vault stays clean — plus a chat summary table.
- A **separate channel** from lint's deterministic sync-time findings tier (#38); same *Finding* semantics: never blocks anything, never edits bodies.

### 7. Run scope (Q7)

- Default: every note with a `## Resources` section (three today); narrowable to named notes on request.
- Verdicts keyed by `res-…` id, matching the registry.

### 8. Skill outline (what `SKILL.md` specifies)

Enumerate Resources (the `resources.md` registry is the roster) → classify by URL pattern → group youtube by video id → fetch/cache sources → extract text → compare per class promise → write report + summarize in chat. The skill carries the citation contract and the never-edit rule.

### 9. Explicitly out of scope here

- No changes to harvester/registry identity, wrapper steps, or lint rules.
- The LLM-assisted grammar layer stays separate fog on the map.

---

Follow-ups applied: glossary updated (*Verification* added); map decision line appended; no fog graduated — this was the last open ticket, so the map's frontier is now empty.
