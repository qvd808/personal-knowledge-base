/**
 * Expected failure conditions (vault root missing or unreadable). Rule
 * violations are data, not errors — they come back in the LintResult.
 */
export class VaultLintError extends Error {}
