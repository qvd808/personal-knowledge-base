---
tags:
  - meta
created: 2026-08-26
---

## Keybindings

Two independent systems bind keys in this vault, and neither can see the other's bindings.
Spacekeys owns the Space leader and draws its own which-key popup; Vimrc Support owns
everything reachable from normal and visual mode.

This note is maintained by hand. Adding a binding to `spacekeys.yml` or `.obsidian.vimrc`
does not update it.

### Spacekeys (Space leader)

Defined in `spacekeys.yml`. Pressing Space alone opens the which-key popup, so this table
is a reference rather than the only way to discover them.

| Keys | Action |
|---|---|
| `Space ?` | Open this note |
| `Space f f` | Quick switcher |

### Vimrc (normal and visual mode)

Defined in `.obsidian.vimrc`. These never appear in any popup.

| Keys | Mode | Action |
|---|---|---|
| `gd` | normal | Follow the wikilink under the cursor |
| `Ctrl+O` | normal | Go back through history |
| `gsi` | normal, visual | Wrap selection or word in `*italic*` |
| `gsb` | normal, visual | Wrap selection or word in `**bold**` |
| `gsc` | normal, visual | Wrap selection or word in `` `code` `` |
| `gsw` | normal, visual | Wrap selection or word in double square brackets, making a wikilink |

Yank and put go through the system clipboard (`set clipboard=unnamedplus`).

Forward navigation (`Ctrl+I`) is commented out in the vimrc on purpose: Obsidian binds that
key to `editor:toggle-italics` by default, and that hotkey has to be cleared in
Settings → Hotkeys before the binding will do anything.

### Useful Spacekeys commands

Reachable from the command palette, not bound to keys:

- **Get key code** — press a key, get the code string `spacekeys.yml` expects.
- **Find command ID** — search for an Obsidian command ID to put in a `command:` entry.
- **Reload keymap** — re-read `spacekeys.yml` without restarting Obsidian.
