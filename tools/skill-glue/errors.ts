/**
 * Expected failure conditions (missing store, malformed frontmatter, validation
 * errors). The CLI reports these and exits non-zero; anything else is a bug and
 * propagates.
 */
export class SkillGlueError extends Error {}
