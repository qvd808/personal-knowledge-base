import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeTmpRoot(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "skill-glue-test-"));
}

export function cleanup(root: string): void {
	fs.rmSync(root, { recursive: true, force: true });
}

export function writeFile(
	root: string,
	relative: string,
	content: string,
): void {
	const absolute = path.join(root, relative);
	fs.mkdirSync(path.dirname(absolute), { recursive: true });
	fs.writeFileSync(absolute, content);
}

export function readFile(root: string, relative: string): string {
	return fs.readFileSync(path.join(root, relative), "utf8");
}

export function exists(root: string, relative: string): boolean {
	return fs.existsSync(path.join(root, relative));
}

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
