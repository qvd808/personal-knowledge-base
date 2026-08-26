import { QuartzTransformerPlugin } from "../types"
import { promoteDisplayMath } from "../../../../../tools/lib/math-blocks"

/**
 * Rewrites single-line `$$…$$` into the fenced form before remark-math parses
 * the file, so Quartz renders it as a display block the way Obsidian already
 * does. Without this the two disagree on identical source: Obsidian treats
 * every `$$…$$` as display, while remark-math only does so when the
 * delimiters sit on their own lines.
 *
 * The rewrite happens in `textTransform`, which runs on raw file text before
 * parsing, so the notes themselves keep the shorter form.
 *
 * Must be registered before Latex(), which is what supplies remark-math.
 */
export const MathBlocks: QuartzTransformerPlugin = () => ({
  name: "MathBlocks",
  textTransform(_ctx, src) {
    return promoteDisplayMath(src)
  },
})
