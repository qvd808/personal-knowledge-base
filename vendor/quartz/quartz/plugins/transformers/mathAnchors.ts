import { anchorDisplayMath } from "../../../../../tools/lib/math-anchors"
import { QuartzTransformerPlugin } from "../types"

/**
 * Wraps a display-math block that carries an Obsidian block anchor in a
 * `<div id="…">`, so the anchor survives KaTeX rendering.
 *
 * Without this, ObsidianFlavoredMarkdown puts the id on the math node and
 * Latex() — which runs after it — replaces that node, taking the id with it.
 * The link then points at an id that is not on the page.
 *
 * The rewrite happens in `textTransform`, on raw file text before parsing, so
 * the notes keep Obsidian's plain `^block-id` line. Because the line is gone
 * before anything parses, ObsidianFlavoredMarkdown never sees it and does not
 * compete for the anchor.
 *
 * Must be registered before MathBlocks(), whose own `textTransform` rewrites
 * the single-line `$$…$$` spelling this one still needs to recognise.
 */
export const MathAnchors: QuartzTransformerPlugin = () => ({
  name: "MathAnchors",
  textTransform(_ctx, src) {
    return anchorDisplayMath(src)
  },
})
