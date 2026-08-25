import crypto from "node:crypto";

/**
 * The #37 anchor identity: `res-` followed by the first 8 hex digits of the
 * SHA-256 of the trimmed verbatim URL. The same URL always carries the same
 * id; collisions between distinct URLs are checked by the caller.
 */
export function resourceId(url: string): string {
	const hash = crypto.createHash("sha256").update(url.trim()).digest("hex");
	return `res-${hash.slice(0, 8)}`;
}
