# Manual smoke checklist — sync wrapper

Run on Windows before any wrapper change lands (#18). The unit tests cover
orchestration with fakes; this checklist covers the real Electron handoff, the
MessageBox, and GCM — the parts fakes can't.

Setup for every case: repo cloned, `npm install` done, Obsidian installed
(if not under `%LOCALAPPDATA%\Obsidian\Obsidian.exe`, point
`tools/sync-wrapper/config.local.json` at it). Launch via `sync.cmd` unless a
case says otherwise.

## 1. Happy path

1. Double-click `sync.cmd`. Obsidian opens the `knowledge` vault.
2. Edit a note, then close Obsidian (File → Exit).
3. A modal "Sync notes to GitHub?" dialog appears. Click **Yes**.

Expected: console shows glue → fill → lint → index → `git add -A` → commit →
`git pull --rebase` → `git push`; exit is clean; GitHub shows a commit like
`sync(YYYY-MM-DD): 1 file changed`.

## 2. Single-instance handoff (no early prompt)

1. Start Obsidian normally (outside the wrapper) and leave it open.
2. Run `sync.cmd`. The second `Obsidian.exe` hands off and exits immediately.
3. Confirm the wrapper does NOT prompt yet (console still waiting).
4. Close the real Obsidian window.

Expected: the prompt appears only after the last Obsidian.exe is gone.

## 3. No path

1. Run `sync.cmd`, edit a note, close Obsidian.
2. At the prompt, click **No**.

Expected: no commit is created (`git log` and `git status` unchanged), the
wrapper exits cleanly, nothing is pushed.

## 4. Offline

1. Disable the network (airplane mode / pull the cable).
2. Run `sync.cmd`, edit a note, close Obsidian, answer **Yes**.
3. Observe the warning dialog: changes stayed local, will push next sync.
4. Re-enable the network, run `sync.cmd` again, answer **Yes**.

Expected: step 3 commits locally, warns (benign wording, not an error), and
exits cleanly; step 4 pushes both commits.

## 5. Planted stale index.lock

1. With no git process running, plant a lock:
   `type nul > .git\index.lock` (from the repo root, cmd).
2. Run `sync.cmd`, close Obsidian, answer **Yes**.

Expected: the wrapper logs that it removed a stale `index.lock` and the sync
proceeds normally. (Variant: start a real long git operation first — the
wrapper must wait for git.exe to exit before touching the lock.)

## 6. First-run GCM sign-in (once per machine)

1. On a fresh machine (or after erasing the github.com credential in Git
   Credential Manager), do one `git push` by hand outside the wrapper.
2. Complete the GCM browser sign-in.

Expected: every wrapper run after that pushes non-interactively — no
credential window appears mid-wrapper. (The wrapper sets
`GIT_TERMINAL_PROMPT=0` / `GCM_INTERACTIVE=0`, so a missing credential fails
fast with a notification instead of hanging.)
