Part of #35

## Question

Design the post-sync verification agent — graduated from fog now that the harvester spec (#38) has closed:

- Classification rules: what counts as website / PDF / YouTube, and what fidelity each class promises.
- Fetch strategy: what gets downloaded, when, and what is cached (all-local preference, Windows-first).
- Note-vs-source comparison: what "the note faithfully represents the source" means per class, and which deviations become findings.
- Findings surface: where verification results appear, and how they relate to the lint findings tier introduced by #38.

Runs as manual agent sessions when it lands; not part of the sync wrapper.
