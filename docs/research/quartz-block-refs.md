# Research: Does Quartz render Obsidian block references?

Resolves qvd808/personal-knowledge-base#36. Researched 2026-08-24 against primary
sources (Quartz v4 docs and source on the `v4` branch, the jackyzha0/quartz issue
tracker, and Obsidian Help); every claim carries its source URL. Statements not
directly backed by a source are marked **[inference]**. Builds on
`docs/research/static-site-generators-obsidian.md` (#11) and
`docs/research/quartz-vendoring-pages.md` (#20), which selected and pinned Quartz v4.

**Decisions this feeds:** the anchor-strategy ticket (T2: block ids preferred,
heading-level fallback) and the resource-harvester spec (T3), whose Resource lines
are list items carrying `^id` anchors.

Pinned upstream state at research time: `v4` branch HEAD is commit
`d25a6eabf96751ffca56f8a8139272def7a65041` (2026-04-20), package version `4.5.2` —
identical to the pin recorded in `docs/research/quartz-vendoring-pages.md`. The
branch has had **zero commits since that date**
(sources: <https://api.github.com/repos/jackyzha0/quartz/commits/v4>,
<https://api.github.com/repos/jackyzha0/quartz/commits?sha=v4&since=2026-04-20T00:00:00Z>),
so everything below describes exactly what we would vendor.

## TL;DR

- **Links:** `[[note#^block-id]]` renders as a working internal link, and target
  blocks get matching DOM `id`s — but the link-side anchor is run through
  github-slugger (lowercased, `^` stripped) while the target `id` keeps its original
  case. **Navigation therefore works only for all-lowercase ids.** Obsidian's short
  auto ids (`^37066d`) work; its long auto-generated ids (mixed case, e.g.
  `^CB-A34B78B4ICqt6zX6xBDAh6CT`) silently fail to scroll (upstream #2225; fix PR
  #2226 was closed **unmerged** — "v5 has been released").
- **Markers:** yes, `^id` markers stay invisible by default
  (`parseBlockReferences: true`): trailing markers are stripped from `<p>`/`<li>`
  text, and a standalone marker paragraph following a blockquote is deleted outright.
- **List items:** an inline trailing `^id` on a bullet point works end-to-end
  (marker stripped, `id` set on the `<li>`). Gaps: mixed-case ids (above), duplicate
  ids silently first-wins, and a standalone marker paragraph after a list attaches
  correctly but leaves an empty `<p>` behind **[inference]**.
- **Consequence for us:** the block-id strategy is viable on stock v4 **if the
  harvester emits explicit lowercase ids** (kebab-case, e.g. `^res-quartz-docs`)
  instead of relying on Obsidian's mixed-case auto ids. Heading-level fallback is
  unnecessary for harvester-generated content. A one-line local patch (skip
  lowercasing for `^`-anchors) is possible at vendor time if we ever want
  mixed-case ids — follow-up decision, not blocking.

## 1. What Obsidian defines (the semantics we must match)

- A block is "a unit of text in your note, such as a paragraph, block quote, or list
  item"; you link to it with `#^` followed by a unique identifier, e.g.
  `[[2023-01-01#^37066d]]`.
  Source: <https://help.obsidian.md/Linking+notes+and+files/Internal+links>
  (raw: <https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/Linking%20notes%20and%20files/Internal%20links.md>)
- Placement rules: *simple paragraphs* take ` ^id` at the end of the line;
  *structured blocks* (lists, quotations, callouts, tables) take the identifier on
  its own line surrounded by blank lines; *specific list lines* may carry the
  identifier directly on the bullet point.
  Source: same Internal links page.
- Identifiers "can only consist of Latin letters, numbers, and dashes" (Obsidian's
  own constraint; its long auto-generated ids also mix upper and lower case).
  Source: same Internal links page.
- Obsidian explicitly warns: "Block references are specific to Obsidian and not part
  of the standard Markdown format. Links containing block references won't work
  outside of Obsidian." Quartz is the exception studied here.
  Source: same Internal links page.

## 2. Link side: how `[[note#^block-id]]` becomes an `<a href>`

- The docs officially support the syntax: "`[[Path to file#^block-ref]]`: produces a
  link to the specific block `block-ref` in the file `Path to file.md`", and
  transclusion "`![[Path to file#^b15695]]`: transclude block with ID `^b15695`".
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/wikilinks.md>
- Wikilinks are parsed by the ObsidianFlavoredMarkdown transformer (shipped and
  enabled by default; `wikilinks: true`),
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/Obsidian%20compatibility.md>
- In the markdown pre-transform, Quartz deliberately preserves the caret:
  `splitAnchor` is applied, then the `^` is re-added for display
  (`const blockRef = Boolean(rawHeader?.startsWith("#^")) ? "^" : ""`), so the
  wikilink survives into mdast intact
  (<https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/transformers/ofm.ts>,
  lines 192–206 at the pinned commit).
- The mdast link node keeps the caret too: `const url = fp + anchor` where
  `anchor` is the raw `^block-id` header (same file, line 293).
- The caret is finally dropped — and the case destroyed — in CrawlLinks, which
  rewrites every internal `href` through `transformLink` → `transformInternalLink` →
  `splitAnchor`, producing `"#" + slugAnchor(anchor)`
  (<https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/transformers/links.ts>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/util/path.ts>).
  `slugAnchor` is github-slugger's `slug`, which lowercases and strips special
  characters including `^`. **[inference]** for the exact character class (source
  file could not be fetched at research time), but the lowercasing is confirmed by
  the Quartz fix author: "The slug function converts the content to lowercase,
  which ultimately causes the navigation failure."
  Sources: <https://github.com/Flet/github-slugger>,
  <https://github.com/jackyzha0/quartz/issues/2226>
- Net effect: `[[note#^CB-A34…]]` renders `href="…note#cb-a34…"` — lowercase, no
  caret.

## 3. Target side: how `^id` markers become DOM anchors

`parseBlockReferences` defaults to `true` (ofm.ts lines 39, 55). The rehype-phase
plugin (ofm.ts lines 546–620) walks the HTML tree:

- `<p>` or `<li>` whose last child is text ending in `^id`
  (`blockReferenceRegex = /\^([-_A-Za-z0-9]+)$/`, line 143): the marker text is
  truncated off (lines 577–579) and the element gets `id="<id>"` — caret stripped,
  **original case preserved** (lines 604–609).
- If truncation empties the node (standalone marker paragraph), Quartz walks
  backwards through siblings and attaches the id to the nearest preceding element,
  e.g. a `<ul>` or `<table>` (lines 582–601). Unlike the blockquote case below, this
  branch does **not** remove the now-empty paragraph **[inference from code read]**.
- `<blockquote>` followed by a standalone marker paragraph: the paragraph is spliced
  out of the tree entirely and the blockquote gets the id (lines 554–571). Callouts
  render as blockquotes, so they ride along.
- First registration wins: later duplicates of the same id are ignored
  (lines 564, 592, 604).
- Registered blocks land in `file.data.blocks`, which powers `![[…#^id]]`
  transclusion.

## 4. Question (a): does clicking scroll to the exact block?

- Client-side, both SPA routes do
  `document.getElementById(decodeURIComponent(url.hash.substring(1)))` followed by
  `scrollIntoView()` — same-page hash clicks and cross-page navigation alike
  (<https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/components/scripts/spa.inline.ts>).
  `getElementById` is case-sensitive.
- Therefore: **scroll works iff the slugified href equals the DOM id**, i.e. iff the
  id contains no uppercase letters (and nothing else github-slugger strips besides
  the caret). Lowercase hex auto ids (`^37066d`) and kebab ids (`^quote-of-the-day`)
  navigate correctly; Obsidian's long mixed-case auto ids do not — the browser lands
  at the top of the target note. Reproduced on v4.5.2 in #2225;
  <https://github.com/jackyzha0/quartz/issues/2225>
- The fix PR (#2226, "fix: support Obsidian block ID wikilinks (#^block-id)
  navigation") was closed on 2026-05-27 **without merging**, with the collaborator
  comment "v5 has been released. Feel free to try it out and reopen this PR if it's
  still relevant." Combined with zero `v4` commits since 2026-04-20, the bug is live
  on the version we would vendor.
  Sources: <https://github.com/jackyzha0/quartz/issues/2226>,
  <https://api.github.com/repos/jackyzha0/quartz/commits?sha=v4&since=2026-04-20T00:00:00Z>
- Hover popovers: docs promise header-scrolling inside previews ("Links to headers
  will also scroll the popup to show that specific header"); block-level popover
  scrolling is not documented. Anchored-link positioning was fixed in #1897.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/popover%20previews.md>,
  <https://github.com/jackyzha0/quartz/issues/1897>

**Verdict (a):** partially — resolves and scrolls to the exact block for
all-lowercase ids; fails silently (top of page) for mixed-case ids on current v4.

## 5. Question (b): do `^id` markers stay invisible?

**Yes, by default.** With `parseBlockReferences: true` (the default), trailing
markers are stripped from paragraph/list-item text and standalone marker paragraphs
after blockquotes are deleted before HTML serialization (§3). Caveats:

- An id outside `[-_A-Za-z0-9]+` (spaces, dots, non-Latin characters) never matches
  `blockReferenceRegex` and remains visible literal text. Obsidian's own charset
  rule (§1) keeps compliant vaults safe.
- **[inference]** Standalone marker paragraphs following non-blockquote elements
  (lists, tables — Obsidian's documented placement for structured blocks) leave an
  empty `<p>` in the output; harmless visually, slightly noisy DOM.

**Verdict (b):** markers stay invisible for conforming ids.

## 6. Question (c): known gaps for block ids on list items

Our Resource lines are list items with inline trailing ids — the best-supported
case — but the gaps around them are:

1. **Mixed-case ids break navigation** (§4). This is the big one: never rely on
   Obsidian's long auto-generated ids for links that must work on Quartz.
   Source: <https://github.com/jackyzha0/quartz/issues/2225>
2. **Duplicate ids silently first-win** within a page (§3); a duplicated `^id` makes
   some links target the wrong block. **[inference]** standard HTML duplicate-id
   behaviour applies on top.
3. **Standalone markers after lists** attach to the `<ul>` but leave an empty
   paragraph **[inference]** (§3). Prefer inline-on-bullet placement, which Obsidian
   documents for "specific lines within a list" anyway (§1).
4. **Dashes used to break recognition** (#712, reported on 4.1.4: "quartz will
   output the block id as plain text"); fixed — the current regex includes `-` and
   `_`. Kebab-case ids are safe today.
   Source: <https://github.com/jackyzha0/quartz/issues/712>
5. Historical rough edges, all closed: blocks resolving to the whole note (#1057),
   improper rendering (#1102), transclusion inside tables (#1803), TOC breakage when
   titles contain `^id` (#1294).
   Sources: <https://github.com/jackyzha0/quartz/issues/1057>,
   <https://github.com/jackyzha0/quartz/issues/1102>,
   <https://github.com/jackyzha0/quartz/issues/1803>,
   <https://github.com/jackyzha0/quartz/issues/1294>

**Verdict (c):** inline list-item ids work; the residual risk is id *content*
(mixed case, duplicates), not list-item placement.

## 7. Implication for the anchor-strategy ticket

- Block ids are viable on stock Quartz v4 **provided the harvester mints explicit
  lowercase ids** (kebab-case: Latin letters, digits, dashes — simultaneously
  satisfying Obsidian's charset rule), e.g. `^res-quartz-docs`. No heading-level
  fallback is needed for harvester-authored content.
- If we ever need mixed-case compatibility, options are a small local patch to
  `splitAnchor` (skip slugification for `^`-anchors) in the vendored copy, or
  tracking the upstream v5 line — both deferred decisions.
