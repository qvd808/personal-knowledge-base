/**
 * Infrastructure failures only (#40 §6): git command errors, unreadable
 * files, malformed wordlist. Findings are data, never errors — they always
 * exit 0.
 */
export class ChangeReviewError extends Error {}
