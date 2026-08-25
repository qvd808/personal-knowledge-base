## Question

Write the build-ready spec for the diff-gated change-review step, independent of the harvester:

- Change detection: diff base (HEAD vs worktree? last sync commit?), filter to `knowledge/*.md`, exclude generated `index.md` / `resources.md`.
- Hunk extraction feeding both the grammar check and later harvest triggers.
- Offline grammar checker: dictionary + swap heuristics (udpate/update, intergraded/integrated, Galina/Gallina); custom wordlist location and growth process; proper-noun and code-fence exemptions.
- Report-only output channel at sync end; never blocks push; never edits bodies.
- Step placement in the wrapper state machine + tests.
