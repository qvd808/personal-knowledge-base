" Quick switcher ≈ Telescope ff. Ctrl+O is unbound in hotkeys.json.
" Space must be unmapped first or Obsidian scrolls instead of chord (vimrc-support README).
unmap <Space>

exmap quickswitcher obcommand switcher:open
nmap <Space>ff :quickswitcher<CR>
