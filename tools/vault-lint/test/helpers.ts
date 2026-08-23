export {
	cleanup,
	exists,
	makeTmpRoot,
	readFile,
	writeFile,
} from "../../lib/test/helpers.ts";

/** A note that satisfies the #7 frontmatter schema. */
export function validNote(body = "Body.\n"): string {
	return `---\ntags:\n  - test\ncreated: 2026-08-23\n---\n\n${body}`;
}
