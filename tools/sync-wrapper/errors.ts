/**
 * Expected failure conditions (missing/malformed config). The CLI reports
 * these and exits non-zero; anything else is a bug and propagates.
 */
export class SyncWrapperError extends Error {}
