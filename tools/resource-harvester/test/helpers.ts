export {
	cleanup,
	exists,
	makeTmpRoot,
	readFile,
	writeFile,
} from "../../lib/test/helpers.ts";

import { resourceId } from "../ids.ts";

export interface FixtureNoteOptions {
	tags?: string[];
	created?: string;
	resources?: string[];
	/** Extra body lines appended after the Resources section closes. */
	trailer?: string;
}

/** A note satisfying the #7 schema with an optional `## Resources` section. */
export function noteMd(options: FixtureNoteOptions = {}): string {
	const tags = options.tags ?? ["fixture"];
	const created = options.created ?? "2026-01-01";
	const tagLines =
		tags.length === 0
			? "tags: []"
			: `tags:\n${tags.map((tag) => `  - ${tag}`).join("\n")}`;
	const resources = options.resources ?? [];
	const section =
		resources.length === 0 ? "" : `\n## Resources\n\n${resources.join("\n")}\n`;
	const trailer = options.trailer === undefined ? "" : `\n${options.trailer}`;
	return `---\n${tagLines}\ncreated: ${created}\n---\n\n# Fixture note\n${section}${trailer}`;
}

/** The registry line format for a URL, with its deterministic id. */
export function registryLine(url: string): string {
	return `- ${url} ^${resourceId(url)}`;
}

/** A minimal hand-written resources.md around the generated markers. */
export function resourcesMd(generatedLines: string[]): string {
	return `---\ntags:\n  - resources\ncreated: 2026-08-01\n---\n<!-- BEGIN GENERATED -->\n\n${generatedLines.join("\n")}\n\n<!-- END GENERATED -->\n`;
}
