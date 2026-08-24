export {
	cleanup,
	exists,
	makeTmpRoot,
	readFile,
	writeFile,
} from "../../lib/test/helpers.ts";

export interface FixtureNote {
	tags?: string[];
	created?: string;
	draft?: boolean;
}

/** A note that satisfies the #7 frontmatter schema. */
export function noteMd(options: FixtureNote = {}): string {
	const tags = options.tags ?? ["fixture"];
	const created = options.created ?? "2026-01-01";
	const tagLines =
		tags.length === 0
			? "tags: []"
			: `tags:\n${tags.map((tag) => `  - ${tag}`).join("\n")}`;
	const draftLine = options.draft ? "draft: true\n" : "";
	return `---\n${tagLines}\ncreated: ${created}\n${draftLine}---\n\n# Fixture note\n`;
}

/** A minimal hand-written index.md: frontmatter, intro, no markers. */
export const INDEX_FIXTURE = `---
tags:
  - index
created: 2026-08-01
---
# Index

Hand-written intro.
`;
