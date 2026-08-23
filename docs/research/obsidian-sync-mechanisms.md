# Survey: Obsidian sync-on-exit mechanisms

Resolves qvd808/personal-knowledge-base#4.

**Target UX (decided):** when the user closes Obsidian, they are asked "sync to
GitHub?"; answering yes batches all changes into one commit and pushes.

**Bottom line:** No in-Obsidian mechanism can reliably prompt on close — the
plugin API's quit event is best-effort and "not guaranteed to actually run"
([Obsidian API docs](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/on(%27quit%27))),
and the obsidian-git maintainer has wontfixed commit-on-close
([issue #13](https://github.com/Vinzent03/obsidian-git/issues/13)). The only
mechanism that fully delivers prompt-on-close + single batched commit is a
**wrapper script** that launches Obsidian, waits for the process to exit, then
prompts and runs git itself. The best in-app compromise is obsidian-git's
`Commit-and-sync and close` command (user-invoked, no prompt).

---

## 1. Obsidian Git plugin (Vinzent03/obsidian-git)

The dominant community plugin for git sync (~11.8k stars). Free, MIT license.
Desktop uses the native git binary; mobile uses isomorphic-git and is "very
unstable" per the README.
Sources: [README](https://github.com/Vinzent03/obsidian-git),
[license](https://api.github.com/repos/Vinzent03/obsidian-git/license),
[docs](https://publish.obsidian.md/git-doc/Start+here).

### Auto commit-and-sync (intervals)

- "Commit-and-sync" = stage everything → commit → pull → push. Pull and push can
  individually be disabled in settings, reducing it to commit-and-pull,
  commit-and-push, or commit only.
  ([Start here — Terminology](https://publish.obsidian.md/git-doc/Start+here))
- Three automatic triggers
  ([Features — Automatic commit-and-sync](https://publish.obsidian.md/git-doc/Features)):
  1. **Interval** ("Auto commit-and-sync interval", every X minutes). The
     interval works across sessions: if you close Obsidian before the interval
     elapses, commit-and-sync runs at next startup. Default is 0 = off
     (`autoSaveInterval: 0` in
     [src/constants.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts)).
  2. **After stopping file edits** — waits X minutes after your latest change.
  3. **After latest commit** — resets the timer against the latest commit
     instead of the plugin's own last run.
- Separate auto-pull-on-startup setting (`autoPullOnBoot`, default off) and
  separate auto-pull / auto-push intervals exist
  ([src/constants.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts)).

### Commit-on-close / prompt-on-close

- **Not supported, and wontfixed.** Issue
  [#13 "Automatic commit & push during closing Obsidian"](https://github.com/Vinzent03/obsidian-git/issues/13)
  (open 2020 → closed 2026-04-16): the maintainer states the plugin cannot delay
  or cancel Obsidian's exit, and there is a ~4 second window before shutdown
  even if the plugin is still pushing — "I doubt that 4 seconds is enough to
  safely commit and push. Maybe it breaks something if it's stopped while
  running." Final close comment: "there is no way for the plugin to do this
  safely and prevent accidental dirty repo state. I'm also suggesting to use the
  provided command to safely commit and sync and then close Obsidian."
- The underlying API limitation is official:
  [`Workspace.on('quit')`](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/on(%27quit%27))
  is "Triggered when the app is about to quit. **Not guaranteed to actually
  run.** Perform some best effort cleanup here."
- A community PR adding exactly this
  ([#1105 "feat: add option to commit-and-sync before quitting"](https://github.com/Vinzent03/obsidian-git/pull/1105),
  June 2026) was **closed unmerged**; the maintainer reiterated that OS shutdown
  timeouts "can easily lead to a corrupted state" and that he favors the
  explicit command. (Verified via GitHub API: `state: closed, merged: false`.)
- **The provided compromise:** the `Commit-and-sync and close` command (added in
  v1.31.0 per the
  [issue #13 thread](https://github.com/Vinzent03/obsidian-git/issues/13)) —
  "Same as `Commit-and-sync`, but if running on desktop, will close the Obsidian
  window. Will not exit Obsidian app on mobile."
  ([README — Available Commands](https://github.com/Vinzent03/obsidian-git)).
  Users in #13 bind it to Alt+F4 / a hotkey and hide the titlebar close button
  via CSS as a workaround. It is **not a prompt** — nothing asks "sync?"; the
  user must choose to invoke the command instead of closing normally.

### Prompt-before-sync

None for the automatic modes — they run silently on their timer. The only
prompt-like UX is the `Commit-and-sync with specific message` /
`Commit all changes with specific message` commands, which open a modal to type
a commit message (a message prompt, not a yes/no confirmation).
([README — Available Commands](https://github.com/Vinzent03/obsidian-git))

### Batching into a single commit

Yes. Every commit-and-sync run stages **all** changes and creates exactly one
commit, then pulls and pushes.
([Start here — Terminology](https://publish.obsidian.md/git-doc/Start+here)).
There is also an opt-in `squashCommitsBeforePush` setting that squashes local
unpushed commits into one before pushing (no force-push; conflicts excluded),
per the comment in
[src/main.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts).

### Conflict behavior

- Default `syncMethod` is `"merge"` (rebase available); `mergeStrategy` default
  `"none"`; `pullBeforePush` default true
  ([src/constants.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts)).
- On a pull conflict, the plugin shows an error ("You have conflicts in N
  files"), writes a `conflict-files-obsidian-git.md` file into the vault listing
  the conflicted files with resolution instructions, and opens it
  (`CONFLICT_OUTPUT_FILE` in
  [src/constants.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts);
  `handleConflict()` in
  [src/main.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts)).
- While conflicts exist, **automatic commit-and-sync aborts** ("Did not commit,
  because you have conflicts… Please resolve them and commit per command") and
  **push is blocked** until the user resolves manually
  ([src/main.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts)).

### Offline behavior

- Network failures are detected by matching git error output ("Could not resolve
  host", "Unable to open connection", SSH timeout/unreachable patterns) and
  rethrown as `NoNetworkError`
  (`convertErrors()` in
  [src/gitManager/simpleGit.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/gitManager/simpleGit.ts)).
- On the first such error the plugin shows "Git: Going into offline mode. Future
  network errors will no longer be displayed." and sets `offlineMode: true`;
  subsequent network errors are logged but not shown. State returns to online
  after the next successful remote operation
  (`handleNoNetworkError()` in
  [src/main.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts)).
- Local commits continue while offline; pushes fail (quietly, in offline mode)
  and go out on the next successful sync. This behavior was hardened after
  [issue #990](https://github.com/Vinzent03/obsidian-git/issues/990), where the
  maintainer confirmed "There is already such offline mode and detection in
  place" and added the reporter's error variant to detection.

### Cost

Free; MIT license. (For contrast, the official non-git Obsidian Sync service is
paid: $4–8/user/month billed annually — [obsidian.md/sync](https://obsidian.md/sync).)

---

## 2. Other community plugins for git sync

Surveyed the official community plugin registry (6,894 plugins;
[obsidianmd/obsidian-releases community-plugins.json](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json)).
The established, manually-reviewed git-sync plugins besides obsidian-git:

### FIT (joshuakto/fit) — free, MIT

- Syncs via the **GitHub REST API** (Octokit) — no local git install needed;
  works on mobile and desktop.
  ([README](https://github.com/joshuakto/fit))
- One-click manual sync plus an auto-sync option. **No prompt-on-close, no
  commit-on-close.**
- Conflicts: local version stays in place, the remote version is written to a
  `_fit/` folder, and the user merges manually; sync itself doesn't fail on
  repeat clashes.
- Still in beta per its README; each sync bundles pending changes (one commit
  per sync via the API).

### GitHub Gitless Sync (silvanocerza/github-gitless-sync) — free, AGPLv3

- Also **GitHub REST API**-only (no git binary), desktop + mobile.
  ([README](https://github.com/silvanocerza/github-gitless-sync))
- Manual ribbon/command sync plus **automatic sync on a fixed interval**. No
  prompt-on-close.
- Conflicts: opens a dedicated resolution view (split or unified diff), or can
  be configured to always prefer remote or local.
- Limitation by design: no local git features (no branching/merging/rebasing),
  GitHub only.

### Git Integration (noradroid/obsidian-git-integration) — free

- Manual, modal-driven: "Git commit" runs `git add .` + `git commit -m`, with an
  optional auto-push checkbox; separate "Git sync" (push) action. Windows 10+,
  requires local git.
  ([README](https://github.com/noradroid/obsidian-git-integration))
- No automatic intervals, no prompt-on-close.

### Long tail

Dozens of newer entries (direct-git-sync, git-vault-sync, hybrid-git-sync,
git-obsi-sync, local-git-sync, sync-git, supersync, …) are flagged in the
registry as "has not been manually reviewed by Obsidian staff." None advertise
prompt-on-close, and **every in-app plugin is bound by the same
`Workspace.on('quit')` "not guaranteed to run" limitation**
([Obsidian API docs](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/on(%27quit%27))),
so none can reliably implement the decided UX from inside Obsidian.

---

## 3. External file-watcher approaches

### gitwatch (gitwatch/gitwatch) — free, GPL-3.0

- A bash script that watches a file/folder with `inotifywait` (Linux) or
  `fswatch` (macOS), waits ~2 s (`SLEEP_TIME`, to let writes finish), then runs
  `git add --all .` + `git commit`; with `-r <remote>` it also pushes.
  ([README — What it does](https://github.com/gitwatch/gitwatch))
- Options: `PULL_BEFORE_PUSH=true` runs `git pull --rebase` before every push;
  `SKIP_IF_MERGING=true` avoids committing while a merge is in progress;
  `EXCLUDE_PATTERN`, `COMMIT_ON_START`; runs as a systemd user service.
- **Prompt-on-close: no.** It reacts to filesystem events, not to Obsidian's
  lifecycle — it commits *while you edit*, producing many small auto-commits
  rather than one batched commit per session (debounce only groups bursts
  seconds apart).
- Conflicts: delegated to git; `pull --rebase` can fail mid-sync and needs
  manual repair. Offline: pushes fail; commits accumulate locally and go out on
  the next successful push (no explicit retry/queue logic documented).

### watchexec (watchexec/watchexec) — free, Apache-2.0

- Generic tool: "Executes commands in response to file modifications"
  ([repo](https://github.com/watchexec/watchexec)). You supply the command,
  e.g. `git add -A && git commit -m … && git push`.
- Has `-d/--debounce <TIMEOUT>` — "Time to wait for new events before taking
  action" — plus filtering by extension/path
  ([watchexec.1 manpage source](https://github.com/watchexec/watchexec/blob/main/doc/watchexec.1.md)).
- Same fundamental limits as gitwatch: **no prompt, no awareness of Obsidian
  closing**; batching is per-debounce-window, not per-session. Conflict and
  offline behavior are whatever your own script implements.

---

## 4. Wrapper-script approaches (launch Obsidian, sync after exit)

Pattern: a small launcher script starts Obsidian, blocks until the process
exits, then runs git. Because the script owns the whole lifecycle, it is the
**only** mechanism that can both show a real "sync to GitHub?" prompt on close
(via `zenity --question`, `osascript`, `notify-send`, etc.) and batch the entire
session into a single commit. All examples below are free.

Documented in the obsidian-git issue #13 thread (primary source:
[issue #13](https://github.com/Vinzent03/obsidian-git/issues/13)):

- **macOS (jgonggrijp):** an AppleScript saved as an app that replaces the
  Obsidian icon:
  `open -Wa Obsidian` (the `-W` flag blocks until Obsidian quits), then
  `cd <vault> && git add . && git commit -m "…" && git push || true`.
  obsidian-git remains responsible for the initial pull and periodic in-session
  backups.
- **Windows (dylan-k):** an AutoHotKey launcher that waits for shutdown and then
  runs the git commands — explicitly motivated by avoiding the 4-second in-app
  limit.
- **Linux (raghavauppuluri13):** a polling daemon
  ([gist](https://gist.github.com/raghavauppuluri13/c55d5a6a820d75926472089c0d842f06))
  that watches `ps` for the Obsidian process: on start → `git pull` (with
  `notify-send` feedback); on exit → `git add . && git commit -m update && git
  push`. Started via `@reboot` cron. This already batches the whole session into
  one commit on close; adding `zenity --question` before the commit turns it
  into the decided prompt UX.

Properties of the approach:

- **Prompt-before-sync: yes** — trivially, the script can ask first and skip the
  commit on "no".
- **Single batched commit: yes** — one `git add -A && git commit` per Obsidian
  session.
- **Conflicts:** script-defined; typical choice is `git pull --rebase` (or
  merge) before pushing and a desktop notification on failure so the user
  resolves manually next session.
- **Offline:** push fails, the commit stays local, and it goes out on the next
  successful sync (or next launch's pull/push). No data loss; just delayed
  remote backup.
- **Robustness:** process-exit detection fires even if Obsidian crashes (unlike
  in-app quit hooks). It fails only if the machine itself powers off — a case no
  mechanism covers. Main usability cost: you must always launch Obsidian through
  the wrapper (replace dock icon / desktop entry / shortcut).

---

## Comparison

| Mechanism | Prompt before sync | One commit per session | Conflict handling | Offline handling | Cost |
|---|---|---|---|---|---|
| obsidian-git auto commit-and-sync | No (silent timer) | No — one commit per interval run | Aborts auto-sync, writes `conflict-files-obsidian-git.md`, manual resolve | Offline mode suppresses errors; commits continue locally, push resumes later | Free (MIT) |
| obsidian-git `Commit-and-sync and close` | No prompt — user must invoke the command | Yes (one commit for all pending changes) | Same as above | Same as above | Free (MIT) |
| FIT / GitHub Gitless Sync / Git Integration | No | One commit per manual/auto sync | `_fit/` folder copy / resolution view / none | Not specified; API calls fail until online | Free |
| gitwatch / watchexec | No | No — per change-burst | Delegated to git (`pull --rebase`, `SKIP_IF_MERGING`) | Commits accumulate locally; push when back | Free (GPL-3.0 / Apache-2.0) |
| Wrapper script | **Yes** | **Yes** | Script-defined (rebase/merge + notify) | Commit stays local, pushed next sync | Free |

## Conclusion for the decided UX

- **Prompt-on-close + single batched commit is only achievable with a wrapper
  script.** In-app prompting on quit is impossible by API design (best-effort
  quit event) and by maintainer decision (wontfix, rejected PR #1105).
- A hybrid used by the community (issue #13): obsidian-git handles pull-on-start
  and periodic in-session commit-and-sync; the wrapper handles the exit prompt
  and the final batched commit/push. This also covers the "forgot to close
  cleanly" case via the interval commits.
- If the prompt requirement is ever relaxed, obsidian-git's
  `Commit-and-sync and close` command (optionally bound to a hotkey, with the
  close button hidden via CSS) is the maintainer-endorsed in-app compromise.

## Sources

- https://github.com/Vinzent03/obsidian-git (README: features, commands incl. `Commit-and-sync and close`, mobile caveats)
- https://publish.obsidian.md/git-doc/Start+here (commit-and-sync definition, terminology)
- https://publish.obsidian.md/git-doc/Features (auto commit-and-sync triggers, cross-session interval)
- https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts (default settings, syncMethod, CONFLICT_OUTPUT_FILE)
- https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts (offline mode, conflict handling, squash-before-push)
- https://github.com/Vinzent03/obsidian-git/blob/master/src/gitManager/simpleGit.ts (NoNetworkError detection)
- https://github.com/Vinzent03/obsidian-git/issues/13 (commit-on-close wontfix; 4 s limit; wrapper-script examples)
- https://github.com/Vinzent03/obsidian-git/issues/874 (duplicate of #13)
- https://github.com/Vinzent03/obsidian-git/issues/990 (offline behavior bug + fix)
- https://github.com/Vinzent03/obsidian-git/pull/1105 (quit-hook PR closed unmerged; API state verified via GitHub API)
- https://docs.obsidian.md/Reference/TypeScript+API/Workspace/on(%27quit%27) (quit event "not guaranteed to actually run")
- https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json (plugin registry survey)
- https://github.com/joshuakto/fit (FIT README)
- https://github.com/silvanocerza/github-gitless-sync (README)
- https://github.com/noradroid/obsidian-git-integration (README)
- https://github.com/gitwatch/gitwatch (README: inotifywait/fswatch, SLEEP_TIME, PULL_BEFORE_PUSH, SKIP_IF_MERGING)
- https://github.com/watchexec/watchexec and https://github.com/watchexec/watchexec/blob/main/doc/watchexec.1.md (debounce option)
- https://gist.github.com/raghavauppuluri13/c55d5a6a820d75926472089c0d842f06 (process-watching sync daemon)
- https://obsidian.md/sync (official paid sync, for cost contrast)
- Licenses verified via GitHub API: obsidian-git MIT, FIT MIT, gitwatch GPL-3.0, watchexec Apache-2.0
