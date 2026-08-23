# Research: Quartz v4 vendoring & Pages build mechanics

Resolves qvd808/personal-knowledge-base#20. Researched 2026-08-23 against primary
sources (Quartz v4 docs and source on the `v4` branch, GitHub Pages/Actions docs,
action READMEs, license file); every claim carries its source URL. Statements not
directly backed by a source are marked **[inference]**. Builds on
`docs/research/static-site-generators-obsidian.md` (issue #11), which selected Quartz v4.

**Decisions this feeds:** vendor pinned Quartz v4 at `vendor/quartz/`; content stays in
`knowledge/` (contains `.obsidian/` and `Excalidraw/`, both excluded); deploy on push to
`main` → GitHub Pages project site at `https://qvd808.github.io/personal-knowledge-base`;
no custom domain.

Pinned upstream state at research time: `v4` branch HEAD is commit
`d25a6eabf96751ffca56f8a8139272def7a65041` (2026-04-20), package version `4.5.2`.
Sources: <https://api.github.com/repos/jackyzha0/quartz/commits/v4>,
<https://raw.githubusercontent.com/jackyzha0/quartz/v4/package.json>

## TL;DR

- Quartz's docs only document one layout — your repo **is** a Quartz clone with content
  inside it. Vendoring into `vendor/quartz/` is a deviation the docs don't cover; use
  `git subtree add/pull --squash` (or a plain re-copy) for upgrades, not
  `npx quartz update`, which assumes the clone-is-the-repo layout.
- Content outside the Quartz root is fully supported via the CLI flag
  `-d`/`--directory` (default `content`); there is **no** config-file key for it. From
  `vendor/quartz/`: `npx quartz build -d ../../knowledge -o ../../public`.
- `ignorePatterns` are fast-glob patterns matched relative to the content directory;
  the default already excludes `.obsidian`. Add `"Excalidraw"` →
  `["private", "templates", ".obsidian", "Excalidraw"]`.
- The `![[simple-state-machine]]` embed of the excluded Excalidraw note does **not**
  break the build; it degrades to a blockquote containing a dead "Transclude of …"
  link. Fix at the source (embed an exported PNG) if that rendering is unacceptable.
- The official Quartz v4 GitHub Pages workflow is copy-paste complete
  (checkout → setup-node 22 → `npm ci` → `npx quartz build` →
  `upload-pages-artifact@v3` → `deploy-pages@v4`) with
  `permissions: contents: read, pages: write, id-token: write`; set
  `baseUrl: "qvd808.github.io/personal-knowledge-base"` and change the trigger branch
  to `main`. Requires Node ≥ 22 / npm ≥ 10.9.2; `package-lock.json` exists on the `v4`
  branch so `npm ci` works.

## 1. Vendoring `vendor/quartz/`

### What the Quartz docs recommend (their only documented model)

- Official setup is: `git clone https://github.com/jackyzha0/quartz.git` → `cd quartz`
  → `npm i` → `npx quartz create`. Your content then lives in `content/` **inside the
  clone**.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/index.md>
- You then make the clone your own repo: create an empty GitHub repo, point `origin`
  at it, and add `upstream https://github.com/jackyzha0/quartz.git` "so updates work".
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/setting%20up%20your%20GitHub%20repository.md>
- Upgrades are `npx quartz update`, which "effectively 'pulls' in the updates from the
  official Quartz GitHub repository"; conflicts are resolved as a normal git merge, and
  `npx quartz restore` restores the content folder from a cache if a merge goes wrong.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/upgrading.md>
- Mechanics of `update` from the source: stash the content folder →
  `git pull upstream v4` (`UPSTREAM_NAME="upstream"`, `QUARTZ_SOURCE_BRANCH="v4"`) →
  restore content → `npm i`.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/handlers.js>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/constants.js>

**Consequence:** the docs do not cover vendoring into a subdirectory, git subtree, or
submodules at all. `npx quartz update`/`sync` are built on the clone-is-the-repo
assumption: the CLI resolves everything against the current working directory
(`cwd = process.cwd()`; it reads `./package.json` and bundles `./quartz/build.ts`
relative to cwd), and `handleSync` runs `git add .` / commit / `pull origin` /
`push -uf origin` in that directory.
Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/constants.js>,
<https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/handlers.js>

**[inference]** In our layout, do not run `npx quartz sync` or `npx quartz update` from
the superproject root (it would commit/push the whole repo and pull upstream into the
wrong place). Upgrades are a git operation on the vendored copy (below), not a Quartz
CLI operation.

### Option comparison for `vendor/quartz/`

| Option | Mechanics | Upgrade path | Costs/risks |
|---|---|---|---|
| Plain copy | Copy the `v4` tree at the pinned commit into `vendor/quartz/`, drop its `.git`; record the SHA in the commit message | Re-copy a new commit's tree and `git diff` to see what changed; local patches re-applied by hand | No upstream metadata; easy to lose track of the exact pin and of local modifications **[inference]** |
| `git subtree` | `git subtree add --prefix=vendor/quartz --squash https://github.com/jackyzha0/quartz.git v4` imports upstream as a single commit joining histories | `git subtree pull --prefix=vendor/quartz --squash https://github.com/jackyzha0/quartz.git v4` merges new upstream state into the subdirectory; local edits under the prefix "remain intact" through merges; conflicts resolve as normal merges | Subdir history is synthetic with `--squash`; contributors don't need to know it's a subtree ("A subtree is just a subdirectory") |
| Fork + submodule | Fork `jackyzha0/quartz`, add the fork as a submodule at `vendor/quartz/` pinned to a `v4`-branch commit | In the submodule: `git fetch`/merge upstream `v4`, then commit the new gitlink in the superproject | Everyone (and CI) must init submodules (`actions/checkout` needs `submodules: true`); the fork must stay public; two repos to keep in sync **[inference]** |

Sources for subtree semantics: <https://raw.githubusercontent.com/git/git/master/contrib/subtree/git-subtree.adoc>
("Subtrees allow subprojects to be included within a subdirectory of the main project";
`add`/`pull`/`merge`/`split`/`push` commands; `--squash` "produce only a single commit
that contains all the differences you want to merge"; "changes made in your local
repository remain intact"). The plain-copy and submodule rows are standard git
behaviour — **[inference]**, no Quartz-specific docs exist for them.

**Recommendation [inference]:** `git subtree add --squash` (or plain copy, given the
`v4` branch is in maintenance — one commit since 2026-04, per the commit API above).
Subtree keeps a reproducible upstream ref and a one-command upgrade path without
submodule UX. Whichever is chosen, record the pinned upstream SHA
(`d25a6eabf96751ffca56f8a8139272def7a65041` at research time) in the vendoring commit
message.

### License obligations (MIT)

Quartz v4 is MIT, "Copyright (c) 2021 jackyzha0". The only condition: "The above
copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software."
Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/LICENSE.txt>

**[inference]** Keeping `vendor/quartz/LICENSE.txt` (and not stripping copyright
headers) satisfies this for all three vendoring options. No attribution on the
rendered site is required.

## 2. Content wiring: `knowledge/` outside the Quartz root

- The content directory is a **CLI flag, not a config key**: `-d`/`--directory`,
  default `"content"`, available on `create`, `build`, `sync`, `update`, `restore`
  (shared `CommonArgv`). The build doc confirms: "`-d` or `--directory`: the content
  folder. This is normally just `content`".
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/args.js>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/build.md>
- There is no content-directory key in the config schema — `GlobalConfiguration` in
  `quartz/cfg.ts` has `pageTitle`, `enableSPA`, `ignorePatterns`, `baseUrl`, `theme`,
  etc., but no directory field.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cfg.ts>
- Path resolution: `resolveContentPath()` returns absolute paths as-is (made relative
  to cwd) and joins relative paths onto `process.cwd()`. So the flag accepts both
  `../../knowledge` (run from `vendor/quartz/`) and an absolute path.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/handlers.js>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/constants.js>
- `npx quartz` must run **from the vendored Quartz root**: the CLI reads
  `./package.json` and `./quartz/build.ts` relative to `process.cwd()`.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/constants.js>
- The output directory is likewise a CLI flag (`-o`/`--output`, default `public`),
  used verbatim (relative to cwd) by the build.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/args.js>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/build.ts>

**Resulting invocation [inference]:**

```bash
cd vendor/quartz && npx quartz build -d ../../knowledge -o ../../public
```

- Does it follow into `knowledge/` cleanly? The build globs `**/*.*` with
  `cwd = argv.directory`, parses the `.md` files, and emits everything else (images,
  attachments) as static assets; the emitter warns if `<directory>/index.md` is missing
  (ours exists at `knowledge/index.md`).
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/build.ts>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/emitters/contentPage.tsx>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/private%20pages.md>
  ("all non-markdown files will be emitted and available publically in the final build")
- Alternative documented mechanism: `npx quartz create --strategy symlink --source
  <path>` makes `content` a symlink to an existing folder. Unneeded here, and note the
  artifact constraint below (no symlinks in the uploaded Pages artifact — that applies
  to `public/`, not the source repo, but the `-d` flag avoids the question entirely).
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cli/args.js>,
  <https://raw.githubusercontent.com/actions/upload-pages-artifact/main/README.md>

## 3. Exclusions: `ignorePatterns` semantics

- `ignorePatterns` is a `quartz.config.ts` key (`configuration.ignorePatterns:
  string[]`, "Glob patterns to not search"). Docs: "a list of glob patterns that Quartz
  should ignore and not search through when looking for files inside the `content`
  folder"; any valid **fast-glob** pattern works, and bash glob syntax differs.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cfg.ts>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/configuration.md>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/private%20pages.md>
- Documented pattern examples: `some/folder` excludes that entire folder; `*.md`
  excludes by extension; `!(*.md)` negation (negations must parenthesize);
  `**/private` excludes a name at any nesting depth.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/private%20pages.md>
- Mechanism: the initial build calls `glob("**/*.*", argv.directory,
  cfg.configuration.ignorePatterns)`, which is globby with `cwd` = the content
  directory, `ignore` = the patterns, and `gitignore: true`. So patterns are **relative
  to the content directory root**, and `.gitignore` rules are *additionally* honoured
  when scanning content.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/build.ts>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/util/glob.ts>,
  <https://raw.githubusercontent.com/sindresorhus/globby/main/readme.md>
- In watch/serve mode the same patterns are applied per-change via `minimatch`, plus
  gitignore, plus a hardcoded `.git/` skip.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/build.ts>

### `.obsidian/`

- The **default** v4 config already ships `ignorePatterns: ["private", "templates",
  ".obsidian"]`.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz.config.ts>
- Belt and braces underneath: globby/fast-glob do not match dotfile path segments
  unless `dot: true` is set ("By default, dotfiles (files starting with `.`) are not
  matched unless you set `dot: true`"), and Quartz's glob call does not set it — so
  `**/*.*` never descends into `.obsidian/` anyway.
  Sources: <https://raw.githubusercontent.com/sindresorhus/globby/main/readme.md>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/util/glob.ts>
- **[inference]** Keep `".obsidian"` in the list regardless: it is the upstream default,
  self-documenting, and protects against any future `dot: true` change.

### `Excalidraw/`

- Our vault has `knowledge/Excalidraw/` at the content root, so the plain pattern
  `"Excalidraw"` excludes the whole folder (same semantics as the documented
  `some/folder` example). If Excalidraw folders could appear at any depth, use
  `"**/Excalidraw"` instead.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/private%20pages.md>
- **Recommended config [inference]:**
  `ignorePatterns: ["private", "templates", ".obsidian", "Excalidraw"]`
- Why exclusion matters: `Excalidraw/simple-state-machine.md` is a *Markdown* file (the
  Obsidian Excalidraw plugin stores drawings as markdown). Without exclusion it would
  be parsed and published as a regular note page. **[inference from the glob/parse
  mechanics]** Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/build.ts>
- Reminder from the docs: `ignorePatterns` only affects the built site; in a public
  repo the files are still public in git — use `.gitignore` too if the content itself
  must stay out of the repo. (Not our case: `knowledge/` is intentionally public.)
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/features/private%20pages.md>

### Gotcha: embeds of excluded notes (`![[simple-state-machine]]`)

`knowledge/finite-state-machine.md` line 15 embeds the excluded Excalidraw note. Traced
through the v4 source:

1. `ObsidianFlavoredMarkdown` turns an embed whose target extension is not an
   image/video/audio/PDF into a transclude placeholder:
   `<blockquote class="transclude" data-slug="…">` wrapping
   `<a class="transclude-inner">Transclude of …</a>`. `![[simple-state-machine]]` (no
   extension) takes this branch.
   Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/transformers/ofm.ts>
2. At render time, `renderTranscludes` looks the target slug up in the parsed pages
   (`componentData.allFiles`). If the page is not found — exactly the case when the
   target was excluded by `ignorePatterns` — it **returns early and leaves the
   blockquote as-is**. No error, no failed build.
   Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/components/renderPage.tsx>
3. The leftover inner link is then processed by `CrawlLinks` like any internal link;
   with the default `markdownLinkResolution: "shortest"` and no matching slug in
   `allSlugs`, it resolves to the would-be slug path — a dead link at runtime.
   Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/transformers/links.ts>,
   <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/util/path.ts>,
   <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz.config.ts>

**Net effect:** the page builds; the embed renders as a blockquote containing a
"Transclude of simple-state-machine" link that 404s. Note that
`ObsidianFlavoredMarkdown`'s `disableBrokenWikilinks` option does **not** help here —
its check sits after the embed branch, so embeds always become transclude placeholders.
Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/plugins/transformers/ofm.ts>

**Options [inference]:** (a) accept the degraded rendering; (b) export the drawing to
`knowledge/images/simple-state-machine.png` and change the embed to
`![[simple-state-machine.png]]` — image embeds are first-class (width/height/alt
supported) and the `images/` folder is emitted as static assets; (c) drop the embed.
Option (b) matches how the rest of the vault already embeds diagrams (all other
`![[…]]` embeds in `knowledge/` are `.png` files).

## 4. GitHub Actions → Pages workflow

### Official Quartz v4 workflow

`docs/hosting.md` on the `v4` branch provides the complete workflow, reproduced here
verbatim (file `.github/workflows/deploy.yml`):

```yaml
name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - v4

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all history for git info
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Dependencies
        run: npm ci
      - name: Build Quartz
        run: npx quartz build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Plus one repo-side setting: Settings → Pages → Source → **GitHub Actions**.
Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/hosting.md>

### Why each piece is required (GitHub/Actions primary sources)

- **Permissions:** the deploying job must have at minimum `pages: write` (lets the
  `GITHUB_TOKEN` create Pages deployments) and `id-token: write` (lets the job request
  the OIDC token GitHub uses to verify the deployment originates from an allowed
  ref). `contents: read` covers checkout. Quartz's example sets all three at workflow
  level.
  Sources: <https://raw.githubusercontent.com/actions/deploy-pages/main/README.md>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/hosting.md>
- **Environment:** the deploy job targets the `github-pages` environment with
  `url: ${{ steps.deployment.outputs.page_url }}` (`page_url` is deploy-pages' output;
  the deploy step needs `id: deployment`). If the environment doesn't exist it is
  created automatically; GitHub recommends a protection rule limiting deploys to the
  default branch. Quartz docs add: if a pre-existing `github-pages` environment blocks
  deployment, delete it and let the workflow recreate it.
  Sources: <https://raw.githubusercontent.com/actions/deploy-pages/main/README.md>,
  <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/hosting.md>
- **Artifact:** `upload-pages-artifact@v3` packages `path` (default `_site/`; Quartz
  sets `public`) as the artifact named `github-pages` — a gzip'd tar, recommended
  under 1 GB, containing no symbolic or hard links. Hidden files are excluded from the
  artifact by default (`include-hidden-files: false`).
  Source: <https://raw.githubusercontent.com/actions/upload-pages-artifact/main/README.md>
- **Source setting:** publishing with a custom Actions workflow requires selecting
  "GitHub Actions" as the Pages source; the general flow GitHub documents is
  checkout → build → `upload-pages-artifact` → `deploy-pages` on push to the default
  branch — exactly Quartz's workflow.
  Source: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>
- **Node version:** Quartz v4 requires Node `>=22` and npm `>=10.9.2`
  (`package.json` `engines`; docs: "at least Node v22 and npm v10.9.2"); the workflow
  pins `node-version: 22`. `npm ci` is viable because `package-lock.json` is committed
  on the `v4` branch.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/package.json>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/index.md>,
  <https://api.github.com/repos/jackyzha0/quartz/contents/package-lock.json?ref=v4>
- **`fetch-depth: 0`:** full clone so the `CreatedModifiedDate` plugin can use git
  history (its default priority list includes `"git"`).
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/hosting.md>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz.config.ts>

### Project-Pages specifics for this repo

- A project site deploys to `http(s)://<owner>.github.io/<repositoryname>` →
  `https://qvd808.github.io/personal-knowledge-base`.
  Source: <https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages>
- Set `baseUrl: "qvd808.github.io/personal-knowledge-base"` in `quartz.config.ts`:
  no protocol, no leading/trailing slashes, and **include the repo-name subpath** for
  project Pages ("if my repository is `jackyzha0/quartz`, GitHub pages would deploy to
  `https://jackyzha0.github.io/quartz` and the `baseUrl` would be
  `jackyzha0.github.io/quartz`"). `baseUrl` feeds sitemaps/RSS/CNAME; Quartz otherwise
  uses relative URLs "to make sure your site works no matter where you end up
  deploying it", so the base path is handled.
  Sources: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/configuration.md>,
  <https://raw.githubusercontent.com/jackyzha0/quartz/v4/quartz/cfg.ts>
- Quartz emits `file.html` rather than `file/index.html`, and GitHub Pages does not
  redirect trailing-slash URLs — only matters when migrating pre-existing
  trailing-slash links; irrelevant for a new site.
  Source: <https://raw.githubusercontent.com/jackyzha0/quartz/v4/docs/hosting.md>

### Adaptations for the vendored layout [inference]

The official workflow assumes Quartz at the repo root. For `vendor/quartz/` +
`knowledge/`:

1. Trigger branch: `main` (not `v4`).
2. Install: `npm ci --prefix vendor/quartz` (or `working-directory: vendor/quartz`).
3. Build: run from the Quartz root with the content/output flags —
   `cd vendor/quartz && npx quartz build -d ../../knowledge -o ../../public`
   (equivalently a step-level `working-directory: vendor/quartz`).
4. Upload: `path: public` (repo root, matching `-o ../../public`).
5. Permissions, concurrency, environment, and deploy job: unchanged from the official
   workflow.

## Open items for the build ticket [inference]

- Choose subtree vs plain copy; record the pinned SHA either way.
- Decide the fate of the one Excalidraw embed (recommend PNG export + image embed).
- Confirm nothing under `knowledge/` is gitignored that should publish (globby honours
  `.gitignore` during the build).
- After first deploy, verify sitemap/RSS URLs reflect the `/personal-knowledge-base`
  base path.
