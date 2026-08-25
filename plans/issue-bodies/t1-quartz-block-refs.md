## Question

The public site will be built with Quartz v4 (planned vendor pin per ARCHITECTURE.md #12; research upstream Quartz v4 today). The resource harvester's output must render there. Verify against primary sources (Quartz docs/source, Obsidian help):

1. Does `[[note#^block-id]]` resolve and scroll to the exact block on the rendered site?
2. Do `^id` markers stay invisible in rendered pages?
3. Any known gaps for block ids on list items (our Resource lines are list items)?

Findings decide the anchor-strategy ticket (block ids preferred, heading-level fallback). Capture findings as a research notes file under `docs/research/`; comment the gist here.
