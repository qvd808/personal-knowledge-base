# Survey: static site generators for Obsidian vaults with graph view

Resolves qvd808/personal-knowledge-base#11. Researched 2026-08-23 against primary
sources (official docs, GitHub repos, license files); every claim carries its source URL.

**Hard constraints:** free, fully static output, interactive graph view REQUIRED,
source repo public, must deploy to GitHub Pages.

## TL;DR

**Quartz (v4 line) is the front-runner.** It is the only surveyed option where the
Obsidian-style graph view, wikilinks, and frontmatter handling are first-party,
maintained features rather than a chain of third-party plugins, and it ships an
official GitHub Pages Actions workflow. Main trade-off: it is a Node/TypeScript
toolchain you vendor into your repo (you clone/fork Quartz and keep content in
`content/`), so upgrades mean merging upstream changes — and upstream has moved on
to Quartz 5, where the graph view was extracted into a community plugin.

Runner-up: **Astro Starlight + `starlight-obsidian` + `starlight-site-graph`** —
a credible, actively maintained two-plugin stack, but the graph is a sidebar widget,
not an Obsidian-fidelity global graph.

## Comparison table

| Option | Graph view (published site) | Wikilinks `[[...]]` | YAML frontmatter | Build complexity | GitHub Pages fit | Maintenance burden | License |
|---|---|---|---|---|---|---|---|
| Quartz v4 | Built-in local + global D3 force graph, Obsidian-like | Built-in (Obsidian compatibility) | Built-in (gray-matter, YAML/TOML) | Low–medium (npm, one config file) | Official Actions workflow in docs | Medium: vendored upstream, v4 superseded by v5 | MIT |
| MkDocs Material + plugins | Third-party only (ECharts/D3 plugins), sidebar/modal | Third-party plugin (roamlinks/wikilinks) | Native in MkDocs | Medium (Python, plugin chain) | Official `mkdocs gh-deploy` / Actions workflow | Medium–high: 2–3 small-community plugins must stay compatible | MIT (theme + plugins) |
| Foam publishing path | None on published site (graph is VS-Code-only) | Via generated link-reference definitions | Jekyll frontmatter on Pages | Low | Template is GitHub-Pages-ready (Jekyll) | Low, but fails the graph constraint | MIT |
| Dendron | Next.js export had graph, but project is dead | Native to Dendron syntax | Native | High (Next.js export) | Documented, but tooling frozen | **Disqualified: active development ceased** | Apache-2.0 |
| Astro Starlight + plugins | `starlight-site-graph` sidebar graph (community) | Via `starlight-obsidian` plugin | Astro content-collections schema | Medium (npm, two plugins) | Official `withastro/action`, `site`+`base` config | Medium: young community plugins | MIT |
| Custom build | Whatever you build (e.g. d3-force) | Whatever you parse (e.g. obsidian-export) | Whatever you parse | Highest | Trivial (any static output works) | Highest: you are the maintainer | Your choice |

---

## 1. Quartz (v4)

- **What it is:** "a fast, batteries-included static-site generator that transforms
  Markdown content into fully functional websites"; the v4 docs bill it as publishing
  digital gardens/notes "for free". Features listed out of the box include "Obsidian
  compatibility, full-text search, graph view, wikilinks, transclusions, backlinks,
  Latex, syntax highlighting, popover previews".
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/index.md>
- **Graph view quality / Obsidian fidelity:** Graph is a first-party component
  (`quartz/components/Graph.tsx`) with a local graph (one-hop neighbourhood of the
  current page) and a toggleable global graph of all notes; configurable
  drag/zoom/depth/scale/repelForce/centerForce/linkDistance/fontSize, tag nodes, and
  radial mode — the same interaction model as Obsidian's local/global graph. The
  package depends on `d3` (force simulation) and `pixi.js` (rendering).
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/components/Graph.tsx>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/package.json>,
  <https://quartz.jzhao.xyz/features/graph-view>
- **Wikilinks:** Supported by default; resolved case-insensitively "to mirror
  Obsidian", including `[[path|alias]]`, `[[path#anchor]]`, `[[path#^block-ref]]`,
  and `![[...]]` embeds/transclusions.
  Source: <https://quartz.jzhao.xyz/features/wikilinks>
- **YAML frontmatter:** First-party `FrontMatter` transformer plugin built on
  `gray-matter` + `remark-frontmatter`; parses YAML (and TOML), understands Obsidian
  conventions: `title`, `tags`/`tag`, `aliases`/`alias`, `permalink`, `cssclasses`,
  `created`/`date`, `modified`/`lastmod`/`updated`, `draft`, `publish`.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/transformers/frontmatter.ts>
- **Build complexity:** Requires Node ≥ 22 and npm ≥ 10.9.2; setup is
  `git clone` → `npm i` → `npx quartz create`, content lives in `content/`.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/index.md>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/package.json>
- **GitHub Pages fit:** Official docs provide a complete GitHub Actions workflow
  (checkout → setup-node 22 → `npm ci` → `npx quartz build` →
  `upload-pages-artifact` → `deploy-pages`). `baseUrl` must be set in the config for
  RSS/sitemap. Caveat: Quartz emits `file.html` (not `file/index.html`), and GitHub
  Pages does not redirect trailing-slash URLs, so pre-existing trailing-slash links
  can break (irrelevant for a new site).
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/hosting.md>
- **Maintenance burden:** You vendor the Quartz codebase (fork/clone) and merge
  upstream updates; the project is very actively maintained (13k+ stars). Note the
  current docs describe Quartz 5, where the graph view was extracted to a community
  plugin (`quartz-community/graph`) — the v4 branch remains available with the graph
  built in, but the v4 line is no longer the development head.
  Sources: <https://github.com/jackyzha0/quartz>, <https://quartz.jzhao.xyz/>,
  <https://quartz.jzhao.xyz/features/graph-view>
- **License/cost:** MIT; free.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/LICENSE.txt>

## 2. MkDocs Material + plugins

- **What it is:** Material for MkDocs is a Python/MkDocs theme, "Documentation that
  simply works", 27k+ stars, MIT-licensed (Copyright 2016–2025 Martin Donath).
  Sources: <https://squidfunk.github.io/mkdocs-material/>,
  <https://raw.githubusercontent.com/squidfunk/mkdocs-material/master/LICENSE>
- **Graph view:** No first-party graph. The closest third-party option is
  `mkdocs-obsidian-interactive-graph-plugin` (MIT): "Plugin for Material for MkDocs
  to draw an interactive graph like Obsidian", rendered with Apache ECharts; the
  sidebar graph is "just available for non-mobile website", with a modal view for
  all devices; since v0.3.0 the sidebar graph is local-only by default. Ordering
  constraint: it "has to be located before plugins that replace wikilinks by
  markdown links", and "currently just wikilinks like `[[Link#Anchor|Custom Text]]`
  are supported". An alternative is `mkdocs-network-graph-plugin` (D3.js, dual
  site-wide/local views, requires Material for MkDocs v9+). Both are small,
  single-maintainer projects (~36 stars for the former).
  Sources: <https://github.com/daxcore/mkdocs-obsidian-interactive-graph-plugin>,
  <https://pypi.org/project/mkdocs-obsidian-interactive-graph-plugin/>,
  <https://github.com/develmusa/mkdocs-network-graph-plugin>
- **Wikilinks:** Not native; needs a plugin such as `mkdocs-roamlinks-plugin`
  (MIT), which converts `[[Page]]`, `[[dir/Page]]`, `[[Page#Heading]]`,
  `![[image.png]]` into relative Markdown links for "vscode-foam & obsidian", or the
  newer `mkdocs-wikilinks-plugin` (WikiLinks `[[Link#anchor|Link Title]]`, code-block
  preservation).
  Sources: <https://github.com/Jackiexiao/mkdocs-roamlinks-plugin>,
  <https://github.com/carlos-truong/mkdocs-wikilinks-plugin>
- **YAML frontmatter:** Native to MkDocs itself: "MkDocs includes support for both
  YAML and MultiMarkdown style meta-data (often called front-matter)"; `title` is a
  recognised key, arbitrary keys pass through to the theme/template. Obsidian-specific
  keys (tags/aliases) need theme/plugin support to be *used*, but parsing is free.
  Source: <https://www.mkdocs.org/user-guide/writing-your-docs/>
- **Build complexity:** Medium. Python + pip; a working Obsidian-vault setup means
  chaining at least a wikilink plugin + a graph plugin + (for callouts etc.) Markdown
  extensions, with documented ordering constraints between them.
- **GitHub Pages fit:** Excellent and documented: official docs ship a GitHub
  Actions workflow (`pip install mkdocs-material` → `mkdocs gh-deploy --force`,
  publishing to the `gh-pages` branch); extra plugins are added to the same
  `pip install` line.
  Source: <https://squidfunk.github.io/mkdocs-material/publishing-your-site/>
- **Maintenance burden:** The theme itself is heavily maintained, but some features
  are gated behind the sponsorware "Insiders" edition (installed from a private repo
  via a personal access token) — the free tier covers everything needed here. The
  real risk is the plugin chain: the graph and wikilink plugins are small community
  projects whose compatibility with each other (ordering) and with new Material
  versions you must police yourself.
  Source: <https://squidfunk.github.io/mkdocs-material/insiders/>
- **License/cost:** MIT for theme and the plugins cited; free. Insiders features
  require sponsorship but are not needed for graph + wikilinks.

## 3. Foam- / Dendron-style publishing paths

### Foam

- **What it is:** "a personal knowledge management system built on Visual Studio
  Code and GitHub" — the tool is a VS Code extension set, not a site generator.
  MIT-licensed. Features include wikilinks, backlinks, and "Graph visualization —
  See your knowledge network visually" — **in the editor**.
  Sources: <https://foambubble.github.io/foam/>,
  <https://raw.githubusercontent.com/foambubble/foam/master/LICENSE>
- **Publishing path:** The official recipe is the `foam-template` repo, "ready to be
  published to GitHub, and GitHub pages": a plain Jekyll-style Pages site (the
  template contains `_layouts/` and `assets/css/style.scss`). To make `[[wikilinks]]`
  navigable on GitHub/Pages you must generate link-reference definitions
  (`Foam › Edit: Link Reference Definitions` → `withExtensions`), i.e. wikilinks are
  compiled down to standard Markdown reference links.
  Sources: <https://docs.foamnotes.com/publishing/publish-to-github/>,
  <https://api.github.com/repos/foambubble/foam-template/contents/>,
  <https://github.com/foambubble/foam>
- **Graph view on the published site:** **None.** The graph visualization is a VS
  Code feature; the published Pages output is static Jekyll HTML with no interactive
  graph. Other recipes (Gatsby etc.) are community-contributed and would mean
  assembling the MkDocs/custom stack anyway.
- **Verdict:** Fails the hard constraint (graph view REQUIRED on the site). Foam is
  an editing environment; its first-party publishing story has no graph.

### Dendron

- **Status:** The README states plainly: "Dendron is currently in maintenace only,
  active development has ceased" (linking to the announcement discussion).
  Sources: <https://raw.githubusercontent.com/dendronhq/dendron/master/README.md>,
  <https://github.com/dendronhq/dendron/discussions/3890>
- **Publishing:** "export your knowledge base as a static (nextjs) site" — a Next.js
  static export with per-vault/hierarchy/note publish permissions.
  Source: <https://raw.githubusercontent.com/dendronhq/dendron/master/README.md>
- **License:** Apache License 2.0 per the current README (the older wiki page still
  says AGPLv3; the repo README is the current statement).
  Sources: <https://raw.githubusercontent.com/dendronhq/dendron/master/README.md>,
  <https://wiki.dendron.so/>
- **Verdict:** Disqualified for a new project: frozen tooling, heavy Next.js export
  pipeline, and Dendron syntax (hierarchies, schemas) diverges from plain Obsidian
  vaults.

## 4. Astro / Starlight

- **What it is:** Starlight is Astro's official docs-site framework, "Build
  beautiful, accessible, high-performance documentation websites with Astro",
  MIT-licensed.
  Sources: <https://github.com/withastro/starlight>,
  <https://raw.githubusercontent.com/withastro/starlight/main/LICENSE>
- **Obsidian ingestion / wikilinks:** No native wikilinks, but the community plugin
  `starlight-obsidian` is purpose-built: "A Starlight plugin to publish Obsidian
  vaults to a Starlight website" — point it at a vault path and it generates the
  vault pages and sidebar entries (handling the Obsidian syntax conversion).
  Sources: <https://starlight-obsidian.vercel.app/getting-started/>,
  <https://starlight.astro.build/resources/plugins/>
- **Graph view:** `starlight-site-graph` (MIT, ~83 stars) is "a Starlight plugin for
  adding a page graph to your website", added as `plugins: [starlightSiteGraph()]` —
  an interactive graph in the page sidebar. `starlight-theme-obsidian` (MIT) mimics
  Obsidian Publish styling and bundles the site graph. Fidelity to Obsidian's
  full-screen global graph is lower than Quartz's: it is a sidebar component first.
  Sources: <https://github.com/Fevol/starlight-site-graph>,
  <https://fevol.github.io/starlight-site-graph/getting-started/>,
  <https://github.com/fevol/starlight-theme-obsidian>
- **YAML frontmatter:** Astro content collections validate frontmatter against a
  schema; `starlight-site-graph` extends the schema (`siteGraphSchema`) for its own
  keys. Standard `title`/tags handling works; Obsidian-specific keys need mapping.
  Source: <https://fevol.github.io/starlight-site-graph/getting-started/>
- **Build complexity:** Medium: npm project, `astro.config.mjs`, two community
  plugins to wire together (vault ingestion + graph).
- **GitHub Pages fit:** First-class: Astro maintains an official action
  (`withastro/action`) and documents the full workflow; for project pages you set
  `site` and `base: '/<repo>'` in `astro.config.mjs`.
  Source: <https://docs.astro.build/en/guides/deploy/github/>
- **Maintenance burden:** Astro/Starlight core is actively maintained; the Obsidian
  and graph plugins are young, small-community projects (both primarily by one
  author) — healthier than the MkDocs graph plugin but still a bus-factor risk.
- **License/cost:** MIT across Astro, Starlight, and both plugins; free.

## 5. Custom build

- **Shape:** Parse the vault yourself (or pre-convert with `obsidian-export`, a Rust
  CLI/library that exports "an Obsidian vault to regular Markdown", BSD-2-Clause-
  Plus-Patent licensed), render with any SSG, and build the graph with a force-layout
  library such as `d3-force` (ISC license) — the same library family Quartz uses.
  Sources: <https://github.com/zoni/obsidian-export>,
  <https://raw.githubusercontent.com/zoni/obsidian-export/main/LICENSE>,
  <https://raw.githubusercontent.com/d3/d3-force/main/LICENSE>
- **Graph view:** Exactly as good as you make it — full Obsidian fidelity is
  achievable (force sim + local/global toggle + visited-node colouring are all
  documented Quartz behaviours you would be re-implementing).
  Source: <https://quartz.jzhao.xyz/features/graph-view>
- **Wikilinks / frontmatter:** You own the parser; `obsidian-export` already handles
  `[[wikilinks]]`, embeds, and frontmatter stripping into CommonMark.
  Source: <https://github.com/zoni/obsidian-export>
- **Build complexity / maintenance:** Highest of all options — every feature
  (search, backlinks, popovers, graph interactions) is yours to build and keep
  working. GitHub Pages fit is trivially perfect (any static output deploys).
- **Verdict:** Only worth it if Quartz's vendored-upstream model is unacceptable;
  otherwise you would be re-building Quartz's feature set from scratch.

## Recommendation

Adopt **Quartz (v4 branch)** for this repo:

1. It is the only option where the required graph view is a maintained, first-party
   feature with Obsidian's local/global interaction model — not a small-community
   plugin bolted onto a docs theme.
2. Wikilinks, frontmatter (incl. Obsidian's tags/aliases/cssclasses), backlinks, and
   search all come from the same codebase, so there is no plugin-compatibility chain
   to police.
3. The documented GitHub Actions → Pages workflow is copy-paste complete, and the
   output is fully static HTML/JS/CSS.
4. MIT, zero cost, public-repo-friendly.

Accept the trade-off consciously: the site repo vendors Quartz itself (Node ≥ 22
toolchain, upstream merges for updates), and the v4 line has been superseded by v5
(graph view moved to a community plugin there) — pin to the `v4` branch and treat
upgrades as deliberate events. If a lighter, more conventional docs stack is ever
preferred, the fallback is **Starlight + starlight-obsidian + starlight-site-graph**,
accepting a sidebar-grade graph rather than an Obsidian-grade one.
