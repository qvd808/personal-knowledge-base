# Research: Windows wrapper mechanics in Node

Resolves qvd808/personal-knowledge-base#19.

Builds on [obsidian-sync-mechanisms.md](obsidian-sync-mechanisms.md) (issue #4), which
decided the wrapper UX: launch Obsidian, wait for exit, prompt "sync to GitHub?", one
batched commit+push on yes. This note covers the Windows/Node mechanics for building it.

**Bottom line:** `child_process.spawn(Obsidian.exe)` + the `'exit'` event is sufficient
as the primary quit signal — no polling loop required — but it must be backed by a
`tasklist` verification pass because of Electron's single-instance handoff (a second
launch exits immediately while Obsidian keeps running). The yes/no prompt is a one-liner
through the inbox `powershell.exe` + WinForms `MessageBox` (no npm deps, no modules to
install). Git is driven with `spawn('git', args)` (no shell, no quoting problems),
`GIT_TERMINAL_PROMPT=0` + `GCM_INTERACTIVE=0` to guarantee no mid-wrapper credential
prompts, and in-progress merge/rebase state is detected exactly the way `git status`
does it: by stat-ing `MERGE_HEAD` / `rebase-merge/` / `rebase-apply/` inside `.git`.
obsidian-git and the wrapper never run git concurrently (the plugin dies with Obsidian);
the only real hazard is a stale `index.lock` from a plugin sync killed at shutdown, so
the wrapper must wait-for/absorb that lock before its own git run.

---

## 1. Spawning Obsidian.exe and detecting full process exit

### The basic mechanism

- `child_process.spawn()` on Windows launches `.exe` files directly; the `.bat`/`.cmd`
  restriction (those need `cmd.exe` or `shell: true`) does not apply to `Obsidian.exe`
  ([Node child_process docs — "Spawning .bat and .cmd files on
  Windows"](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows)).
- The `'exit'` event "is emitted after the child process ends. If the process exited,
  `code` is the final exit code… One of the two [`code`/`signal`] will always be
  non-null" ([Node docs — Event:
  'exit'](https://nodejs.org/api/child_process.html#event-exit)). The `'close'` event
  fires only after the child's stdio streams close and "will always emit after `'exit'`"
  ([Node docs — Event:
  'close'](https://nodejs.org/api/child_process.html#event-close)). With
  `stdio: 'ignore'` (appropriate for a GUI app), `'exit'` is the right signal; listen to
  `'error'` too, since `'exit'` "may or may not fire after an error has occurred"
  (same page).
- **Does main-process exit mean "app quit"?** Obsidian is an Electron app (Obsidian is
  closed-source; Electron basis is visible from its distributed binaries — inference).
  Electron's default behavior: "If you do not subscribe to [`window-all-closed`] and all
  windows are closed, the default behavior is to quit the app"
  ([Electron app docs — Event:
  'window-all-closed'](https://www.electronjs.org/docs/latest/api/app#event-window-all-closed)),
  and quitting the app terminates the main process, i.e. `Obsidian.exe`. So closing the
  last Obsidian window (or File → Exit) ends the spawned process and fires `'exit'`
  (inference from the Electron default; Obsidian has no documented keep-alive/tray mode).
  Renderer/GPU helper processes are children of `Obsidian.exe`, not of the wrapper, so
  the wrapper never needs to track them.
- **`open -Wa` equivalent on Windows:** there is no cmd builtin, but PowerShell's
  `Start-Process -Wait` "waits for the specified process and its descendants to complete
  before accepting more input… waits for the process tree (the process and all its
  descendants) to exit" ([Microsoft Learn —
  Start-Process](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process#-wait)).
  From Node this is unnecessary — `spawn` + `'exit'` is strictly more direct — but it is
  the answer if any part of the wrapper is ever written in PowerShell.

### Pitfall 1: single-instance handoff (the big one)

- Electron apps can hold a single-instance lock: a second launch "calls
  `app.requestSingleInstanceLock()`", fails to acquire it, and quits, while the primary
  instance receives a `'second-instance'` event and typically focuses its window
  ([Electron app docs —
  app.requestSingleInstanceLock](https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelock)).
- Obsidian exhibits exactly this behavior per its official docs: opening
  `obsidian://open?vault=my%20vault` — "If the vault is already open, focus on the
  window" ([Obsidian Help — Obsidian
  URI](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI)).
- Consequence (inference): if Obsidian is already running when the wrapper spawns
  `Obsidian.exe`, the spawned process hands off and exits immediately; `'exit'` fires
  while Obsidian is still open, and the wrapper would prompt way too early.
- **Mitigation (design recommendation, inference):** treat `'exit'` as a hint, then
  verify no `Obsidian.exe` remains before prompting:
  `tasklist /FI "IMAGENAME eq Obsidian.exe" /NH` (filter syntax: [Microsoft Learn —
  tasklist](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tasklist));
  if any instance remains, poll every few seconds until none do. For checking a specific
  pid, `process.kill(pid, 0)` works on Windows: "Sending signal `0` can be used as a
  platform independent way to test for the existence of a process" ([Node docs — Signal
  events](https://nodejs.org/api/process.html#signal-events); also [process.kill](https://nodejs.org/api/process.html#processkillpid-signal))
  — but pid-checking alone does not cover the handoff case, since the surviving
  Obsidian is a *different* process.
- The same verification pass covers **updater relaunches**: Obsidian's in-app update
  flow relaunches the app, so the spawned process exits while a new `Obsidian.exe`
  starts (inference — Obsidian's updater behavior is not covered in its official docs;
  the tasklist check makes the wrapper robust to it regardless).

### Pitfall 2: launching the right vault

- Spawning `Obsidian.exe` with no arguments opens the last-used vault; to target a
  vault, pass the official URI as the single argument:
  `spawn('Obsidian.exe', ['obsidian://open?vault=my%20vault'])` — URI format and `open`
  action per [Obsidian Help — Obsidian
  URI](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI) (the same page notes
  running the app once registers the `obsidian://` protocol on Windows).
- The wrapper should take the Obsidian.exe path from config rather than assuming an
  install location (recommendation; the [official install
  docs](https://help.obsidian.md/Getting+started/Download+and+install+Obsidian) do not
  document a fixed install path).

### Verdict for Q1

`spawn` + `'exit'` suffices as the primary mechanism; **process polling is not needed as
the main loop but is required as a post-`'exit'` verification** (tasklist by image name)
to survive single-instance handoffs and updater relaunches. Do not set
`options.detached` — the default (parent waits) is what the wrapper wants ([Node docs —
options.detached](https://nodejs.org/api/child_process.html#optionsdetached)).

---

## 2. Native yes/no prompt from Node on Windows

### Winner: `powershell.exe` + WinForms `MessageBox` (zero installs)

- Windows PowerShell 5.1 "is the version of PowerShell that ships in Windows"
  ([Microsoft Learn — What is Windows
  PowerShell?](https://learn.microsoft.com/en-us/powershell/scripting/what-is-windows-powershell?view=powershell-5.1))
  — `powershell.exe` is always present on the target machine.
- `[System.Windows.Forms.MessageBox]::Show(...)` returns "one of the `DialogResult`
  values" and takes a `MessageBoxButtons` argument (`YesNo` included) ([Microsoft Learn
  — MessageBox.Show](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.messagebox.show)).
- STA is the default apartment state for both `powershell.exe` (since PowerShell 3.0:
  [about_PowerShell_exe](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe#-sta))
  and `pwsh` 7.x ("This is the default":
  [about_Pwsh](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pwsh#-sta)),
  so WinForms works without extra flags; passing `-Sta` explicitly is harmless.
- Driven from Node with no npm deps:

  ```js
  const { spawn } = require('node:child_process');
  const ps = spawn('powershell.exe', [
    '-NoProfile', '-Sta', '-Command',
    `Add-Type -AssemblyName System.Windows.Forms;
     [System.Windows.Forms.MessageBox]::Show(
       'Sync notes to GitHub?', 'Obsidian sync', 'YesNo', 'Question'
     ).ToString()`,
  ], { windowsHide: true });
  // read stdout: "Yes" | "No"
  ```

  `windowsHide` hides the console window that would otherwise flash up ([Node docs —
  windowsHide](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)).
  (Code sample is this note's own composition of the cited APIs, not a copied source.)

### Ruled out

- **`msg.exe`**: displays a message to a session but has no yes/no return channel — it
  only displays text (default 60 s before it disappears) and `/w` merely "waits for an
  acknowledgment" ([Microsoft Learn —
  msg](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msg)).
  Not a prompt.
- **BurntToast (Windows toast)**: a PowerShell Gallery module — `Install-Module -Name
  BurntToast` ([BurntToast
  README](https://github.com/Windos/BurntToast/blob/main/README.md)) — i.e. an extra
  install, violating the "no extra deps" constraint. Toasts are also non-modal
  notifications, not blocking dialogs (inference from their purpose as stated in the
  README: "displaying Toast Notifications"). Reasonable later for "push failed"
  notifications, wrong tool for the blocking yes/no.
- **WSH/VBScript `MsgBox`**: works today via `cscript`, but "VBScript is deprecated. In
  future releases of Windows, VBScript will be available as a feature on demand before
  its removal from the operating system" ([Microsoft Learn — Deprecated features for
  Windows
  client](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features),
  October 2023). Do not build new tooling on it.
- **WSL interop**: only relevant during development. From WSL, Windows tools run
  directly as `[tool-name].exe` (e.g. `powershell.exe`), retaining the WSL working
  directory and running as the active Windows user ([Microsoft Learn — Working across
  file systems / interop](https://learn.microsoft.com/en-us/windows/wsl/filesystems)).
  The production wrapper runs as Windows Node against the Windows vault, so no interop
  is involved at runtime.

### Verdict for Q2

PowerShell + WinForms `MessageBox` is the most reliable yes/no mechanism and needs
nothing beyond inbox Windows components; drive it with one `spawn` call and parse
stdout. Fallback if a terminal is guaranteed: a readline prompt in the wrapper's own
console (zero-dep, but unavailable when launched from a desktop shortcut — inference).

---

## 3. Git via child_process on Windows

### Spawning and quoting

- Spawn `git` (a real `.exe`) with an args array and the default `shell: false`; no
  cmd.exe is involved, so **no shell quoting/escaping problems exist** — paths with
  spaces are just single array elements. Node handles the Windows command-line quoting
  itself unless `windowsVerbatimArguments: true` is set ("No quoting or escaping of
  arguments is done on Windows", default `false`) ([Node docs —
  child_process.spawn](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)).
  The `.bat`/`.cmd` caveat does not apply to `git.exe` ([Node
  docs](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows)).
- Point git at the vault via the spawn `cwd` option or `git -C <vault>`; pass
  `windowsHide: true` so git spawns don't flash console windows ([Node docs —
  windowsHide](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)).

### Guaranteeing no mid-wrapper prompts

Set these in the spawn `env`:

- `GIT_TERMINAL_PROMPT=0` — "git will not prompt on the terminal (e.g., when asking for
  HTTP authentication)" ([git docs — Environment
  Variables](https://git-scm.com/docs/git#_environment_variables)).
- `GIT_EDITOR=true` (and `GIT_SEQUENCE_EDITOR=true` for safety) — `GIT_EDITOR` "is used
  by several Git commands when, on interactive mode, an editor is to be launched"
  ([git docs — Environment
  Variables](https://git-scm.com/docs/git#_environment_variables)); setting it to the
  `true` builtin makes any would-be editor invocation a no-op (inference — standard
  practice, mechanism per the cited doc).
- `GCM_INTERACTIVE=0` — "Permit or disable GCM from interacting with the user (showing
  GUI or TTY prompts). If interaction is required but has been disabled, an error is
  returned" ([GCM docs —
  environment.md](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/environment.md#gcm_interactive)).

### Credentials (Git Credential Manager)

- "GCM is included with Git for Windows. During installation you will be asked to
  select a credential helper, with GCM listed as the default" ([GCM docs —
  install.md](https://github.com/git-ecosystem/git-credential-manager/blob/release/docs/install.md#windows)).
- GCM "is called implicitly by Git… when pushing (`git push`) to … GitHub, a window
  will automatically open and walk you through the sign-in process… Later Git commands
  in the same repository will re-use existing credentials or tokens that GCM has stored
  for as long as they're valid" ([GCM README — How to
  use](https://github.com/git-ecosystem/git-credential-manager#how-to-use)).
- Consequence (inference): do the first-ever `git push` outside the wrapper (one-time
  GCM sign-in window); every wrapper run after that is non-interactive. With
  `GCM_INTERACTIVE=0` + `GIT_TERMINAL_PROMPT=0`, a missing/expired credential fails fast
  with an error instead of hanging the wrapper — surface it via the notification path.

### `git pull --rebase`, non-interactively

- `git pull --rebase` rebases "the current branch on top of the upstream branch after
  fetching"; without any reconcile flag, `--ff-only` is the default ([git-pull
  docs](https://git-scm.com/docs/git-pull)). A non-interactive rebase opens no editor;
  on conflict "rebase stops and asks the user to resolve", and is resumed with
  `git rebase --continue` or unwound with `git rebase --abort` ([git-rebase
  docs](https://git-scm.com/docs/git-rebase)).
- Wrapper policy (design recommendation, inference): commit first (clean tree), then
  `pull --rebase`, then `push`. If the rebase exits non-zero, do **not** auto-continue;
  notify and leave the state for manual resolution (or offer `--abort`). `--autostash`
  ([git-pull docs](https://git-scm.com/docs/git-pull)) is unnecessary once the wrapper
  commits before pulling.

### Detecting in-progress merge/rebase state

Check the same files `git status` itself checks — `wt_status_get_state()` in git's own
`wt-status.c`:

- merge in progress ⇔ `.git/MERGE_HEAD` exists
  (`if (!stat(git_path_merge_head(r), &st)) … state->merge_in_progress = 1`);
- rebase in progress ⇔ `.git/rebase-merge/` or `.git/rebase-apply/` directory exists
  (`stat(worktree_git_path(wt, "rebase-apply"))`, `stat(worktree_git_path(wt,
  "rebase-merge"))`);
- cherry-pick/revert ⇔ `CHERRY_PICK_HEAD` / `REVERT_HEAD` refs exist.

Source: [wt-status.c (git
master)](https://github.com/git/git/blob/master/wt-status.c), function
`wt_status_get_state`. Corroborating docs: `MERGE_HEAD` "is set to point to the other
branch head" during a merge and `--abort` applies "when `MERGE_HEAD` is present"
([git-merge docs](https://git-scm.com/docs/git-merge)); `REBASE_HEAD` names the commit
being applied during a rebase ([git-rebase
docs](https://git-scm.com/docs/git-rebase)). From Node, plain `fs.existsSync()` on those
`.git` paths is enough (inference — trivial application of the cited detection logic).

### Lock files

- Git's lockfile API creates `<path>.lock` "with `O_CREAT|O_EXCL` so that we can notice
  and fail if somebody else has already locked the file", and cleans locks up on normal
  exit or signals via `atexit`/signal handlers ([git source —
  lockfile.h](https://github.com/git/git/blob/master/lockfile.h)).
- Consequence: `.git/index.lock` present ⇒ either a git process is mid-operation right
  now, or one was hard-killed (cleanup handlers don't run on `TerminateProcess` —
  inference from the cited mechanism). The wrapper must (a) wait/retry while any
  `git.exe` is alive, and (b) only treat the lock as stale (delete and retry) once no
  `git.exe` remains (design recommendation, inference). The failure to match on stderr
  is the "Unable to create … index.lock: File exists" message emitted via
  `unable_to_lock_die` (same source).

---

## 4. obsidian-git on Windows vs. the wrapper's exit push

Facts about the plugin (carried over from the #4 survey; sources: [obsidian-git
README](https://github.com/Vinzent03/obsidian-git), [Start
here](https://publish.obsidian.md/git-doc/Start+here),
[Features](https://publish.obsidian.md/git-doc/Features),
[constants.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts),
[main.ts](https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts), [issue
#13](https://github.com/Vinzent03/obsidian-git/issues/13)):

- Desktop uses the native git binary; commit-and-sync = stage all → commit → pull →
  push. Auto-pull-on-startup (`autoPullOnBoot`) defaults **off**; the auto
  commit-and-sync interval defaults to 0 (**off**) and works across sessions (a missed
  interval fires at next startup).
- On pull conflicts the plugin aborts automatic commit-and-sync and blocks pushing
  until manual resolution.
- The plugin cannot delay or cancel Obsidian's exit; there is a ~4 s window between
  quit starting and process death (maintainer, issue #13).

Interaction analysis (inference, grounded in the above):

- **No true concurrency.** obsidian-git only runs while Obsidian runs; the wrapper's
  git work starts after `Obsidian.exe` is gone. Pull-on-start (plugin) and
  commit/push-on-exit (wrapper) are separated by the entire session.
- **The one real hazard: the shutdown boundary.** If an interval commit-and-sync is
  mid-flight when the user quits, the plugin's spawned git processes may still be
  finishing — or be hard-killed — as Obsidian exits (the 4 s window, issue #13). A
  hard-killed git can leave a stale `.git/index.lock` (lockfile.h mechanism, §3). The
  wrapper should therefore wait for no-`git.exe`-running + no `index.lock` (with a
  timeout and stale-lock cleanup) before its own `git add`. No other lock-file
  conflicts are expected.
- **Recommended division of labor (design recommendation):** enable obsidian-git's
  pull-on-startup so session start is synced in-app; leave interval commit-and-sync
  optional as crash insurance; let the wrapper own the exit prompt + batched
  commit + `pull --rebase` + push. Do not also use the plugin's `Commit-and-sync and
  close` command — that would double-commit/double-prompt the same flow (inference).

---

## Checklist for the build ticket

1. `spawn(obsidianExe, ['obsidian://open?vault=<name>'], { stdio: 'ignore' })`; on
   `'exit'` (also handle `'error'`), verify with `tasklist /FI "IMAGENAME eq
   Obsidian.exe"`; poll until gone. (§1)
2. Prompt via `powershell.exe -NoProfile -Sta -Command` + WinForms `MessageBox`,
   `windowsHide: true`, parse stdout `Yes`/`No`. (§2)
3. Git: `spawn('git', [...], { cwd: vault, windowsHide: true, env: { …,
   GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: '0', GIT_EDITOR: 'true',
   GIT_SEQUENCE_EDITOR: 'true' } })`; first-ever push done manually beforehand. (§3)
4. Pre-flight: refuse/notify if `MERGE_HEAD`, `rebase-merge/`, or `rebase-apply/`
   exists; wait out `index.lock` while `git.exe` lives, clean it if stale. (§3, §4)
5. Sequence: `git add -A` → `git commit` → `git pull --rebase` → `git push`; on rebase
   stop, notify (never auto-`--continue`). (§3)
6. obsidian-git settings: `autoPullOnBoot` on; interval sync optional; don't use
   `Commit-and-sync and close` alongside the wrapper. (§4)

## Sources

- https://nodejs.org/api/child_process.html (spawn, `'exit'`/`'close'` events, windowsHide, windowsVerbatimArguments, .bat/.cmd section, options.detached)
- https://nodejs.org/api/process.html#signal-events and #processkillpid-signal (signal 0 as existence test, platform-independent incl. Windows)
- https://www.electronjs.org/docs/latest/api/app (window-all-closed default quit; requestSingleInstanceLock / second-instance)
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process (-Wait waits for process tree)
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.messagebox.show (returns DialogResult; MessageBoxButtons)
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe (-Sta default since PowerShell 3.0)
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pwsh (-Sta default in pwsh 7.x)
- https://learn.microsoft.com/en-us/powershell/scripting/what-is-windows-powershell?view=powershell-5.1 (Windows PowerShell 5.1 ships in Windows)
- https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msg (msg.exe: display-only, 60 s default, /w acknowledgment)
- https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tasklist (/FI IMAGENAME filter)
- https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features (VBScript deprecated, Oct 2023)
- https://learn.microsoft.com/en-us/windows/wsl/filesystems (WSL↔Windows interop: run Windows tools as [tool-name].exe)
- https://github.com/Windos/BurntToast/blob/main/README.md (Install-Module requirement; toast notifications)
- https://git-scm.com/docs/git (GIT_TERMINAL_PROMPT, GIT_ASKPASS, GIT_EDITOR, GIT_SEQUENCE_EDITOR)
- https://git-scm.com/docs/git-pull (--rebase, --ff-only default, --autostash)
- https://git-scm.com/docs/git-rebase (stop on conflict; --continue/--abort; REBASE_HEAD)
- https://git-scm.com/docs/git-merge (MERGE_HEAD semantics; --abort)
- https://github.com/git/git/blob/master/wt-status.c (wt_status_get_state: MERGE_HEAD / rebase-merge / rebase-apply / CHERRY_PICK_HEAD / REVERT_HEAD detection)
- https://github.com/git/git/blob/master/lockfile.h (lockfile API: O_CREAT|O_EXCL, .lock suffix, atexit/signal cleanup)
- https://github.com/git-ecosystem/git-credential-manager (README: implicit invocation, first-use sign-in window, token reuse)
- https://github.com/git-ecosystem/git-credential-manager/blob/release/docs/install.md (GCM bundled with Git for Windows, default helper)
- https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/environment.md (GCM_INTERACTIVE)
- https://help.obsidian.md/Extending+Obsidian/Obsidian+URI (obsidian://open; "if the vault is already open, focus on the window"; protocol registration on Windows)
- https://help.obsidian.md/Getting+started/Download+and+install+Obsidian (no documented fixed install path)
- https://github.com/Vinzent03/obsidian-git (README: desktop uses native git binary)
- https://publish.obsidian.md/git-doc/Start+here and /Features (commit-and-sync definition; cross-session interval)
- https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts (autoPullOnBoot / interval defaults off)
- https://github.com/Vinzent03/obsidian-git/blob/master/src/main.ts (conflict abort, push blocked)
- https://github.com/Vinzent03/obsidian-git/issues/13 (~4 s shutdown window; wrapper motivation)
