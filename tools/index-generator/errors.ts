/**
 * Expected failure conditions (missing vault or index.md, unbalanced markers,
 * notes without usable frontmatter). The CLI reports these and exits
 * non-zero; anything else is a bug and propagates.
 */
export class IndexGeneratorError extends Error {}
