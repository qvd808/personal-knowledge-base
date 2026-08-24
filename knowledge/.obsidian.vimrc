" Enforced vault navigation: Space+ff opens the quick switcher (Telescope-like).
" Ctrl+O is unbound in .obsidian/hotkeys.json so this is the primary path.
let mapleader = " "

exmap quickswitcher obcommand switcher:open
nmap <leader>ff :quickswitcher<CR>
