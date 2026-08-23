import { writeFile } from "../../lib/test/helpers.ts";

export {
	cleanup,
	exists,
	makeTmpRoot,
	readFile,
	writeFile,
} from "../../lib/test/helpers.ts";

export interface FixtureSkill {
	description?: string;
	disabled?: boolean;
	files?: Record<string, string>;
}

export function skillMd(name: string, options: FixtureSkill = {}): string {
	const description = options.description ?? `The ${name} skill.`;
	const metadata = options.disabled ? "metadata:\n  disabled: true\n" : "";
	return `---\nname: ${name}\ndescription: ${description}\n${metadata}---\n\n# ${name}\n\nBody of ${name}.\n`;
}

export function addStoreSkill(
	root: string,
	name: string,
	options: FixtureSkill = {},
): void {
	writeFile(root, `.agents/skills/${name}/SKILL.md`, skillMd(name, options));
	for (const [relative, content] of Object.entries(options.files ?? {})) {
		writeFile(root, `.agents/skills/${name}/${relative}`, content);
	}
}
