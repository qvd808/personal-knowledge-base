" Vimrc Support: custom normal-mode bindings live here.
" Quick switcher (Space f f) is handled by the Spacekeys plugin + spacekeys.yml —
" CodeMirror cannot bind <Space>ff reliably via vimrc (space scrolls instead).

" --- Clipboard -----------------------------------------------------------
" Yank and put go through the system clipboard. The plugin treats
" unnamedplus as an alias of unnamed; both mean the same thing here.
set clipboard=unnamedplus

" --- Wikilink navigation -------------------------------------------------
" gd follows the link under the cursor; Ctrl+O walks back through history.
" Ctrl+O is free because hotkeys.json clears Obsidian's default binding of it
" to switcher:open (Space f f covers the quick switcher instead).
exmap followlink obcommand editor:follow-link
nmap gd :followlink

exmap back obcommand app:go-back
nmap <C-o> :back

" Forward navigation is left commented out on purpose: Obsidian binds Ctrl+I
" to editor:toggle-italics by default, so that hotkey has to be cleared in
" Settings -> Hotkeys before these two lines will do anything.
" exmap forward obcommand app:go-forward
" nmap <C-i> :forward

" --- Emphasis ------------------------------------------------------------
" The plugin's surround command wraps the visual selection or, when there is
" no selection, the word under the cursor, which gives these bindings the same
" ergonomics as gUiw. obcommand editor:toggle-bold is deliberately not used:
" entering ex mode drops the CodeMirror selection before the command runs, so
" it would never see the visual range.
" These must use map rather than nmap, because surround is wanted in visual
" mode as well as normal mode.
exmap surround_italic surround * *
exmap surround_bold surround ** **
exmap surround_code surround ` `
exmap surround_wiki surround [[ ]]

map gsi :surround_italic
map gsb :surround_bold
map gsc :surround_code
map gsw :surround_wiki
