import fs from "node:fs";
import path from "node:path";
import { SkillGlueError } from "./errors.ts";
import { parseSkillMd } from "./frontmatter.ts";

export const STORE_DIR = ".agents/skills";
export const GLUE_DIR = ".claude/skills";
export const SKILL_MD = "SKILL.md";
export const MAX_DESCRIPTION_LENGTH = 1024;

export interface SkillFile {
	/** POSIX-style path relative to the skill directory. */
	relativePath: string;
	content: Buffer;
}

export interface Skill {
	name: string;
	description: string;
	disabled: boolean;
	files: SkillFile[];
}

function toPosix(relative: string): string {
	return relative.split(path.sep).join("/");
}

function collectFiles(dir: string, base: string, out: SkillFile[]): void {
	const entries = fs
		.readdirSync(dir, { withFileTypes: true })
		.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(full, base, out);
		} else if (entry.isFile()) {
			out.push({
				relativePath: toPosix(path.relative(base, full)),
				content: fs.readFileSync(full),
			});
		}
	}
}

function readSkill(root: string, dirName: string): Skill {
	const dir = path.join(root, STORE_DIR, dirName);
	const skillMdPath = path.join(dir, SKILL_MD);
	const displayDir = `${STORE_DIR}/${dirName}`;
	if (!fs.existsSync(skillMdPath) || !fs.statSync(skillMdPath).isFile()) {
		throw new SkillGlueError(
			`${displayDir}/ has no ${SKILL_MD} — every skill directory needs one`,
		);
	}
	const frontmatter = parseSkillMd(
		fs.readFileSync(skillMdPath, "utf8"),
		`${displayDir}/${SKILL_MD}`,
	);
	if (frontmatter.name !== dirName) {
		throw new SkillGlueError(
			`${displayDir}/${SKILL_MD}: frontmatter name "${frontmatter.name}" does not match directory "${dirName}"`,
		);
	}
	const descriptionLength = frontmatter.description
		.replace(/\s+/g, " ")
		.trim().length;
	if (descriptionLength > MAX_DESCRIPTION_LENGTH) {
		throw new SkillGlueError(
			`${displayDir}/${SKILL_MD}: description is ${descriptionLength} chars, over the ${MAX_DESCRIPTION_LENGTH} limit`,
		);
	}
	const files: SkillFile[] = [];
	collectFiles(dir, dir, files);
	return {
		name: frontmatter.name,
		description: frontmatter.description,
		disabled: frontmatter.disabled,
		files,
	};
}

/**
 * Reads the canonical skill store. A missing or empty store is an error, never
 * a reason to delete glue (#15: glue is only ever generated FROM the store).
 */
export function readStore(root: string): Skill[] {
	const storePath = path.join(root, STORE_DIR);
	if (!fs.existsSync(storePath) || !fs.statSync(storePath).isDirectory()) {
		throw new SkillGlueError(
			`skill store not found at ${STORE_DIR}/ — refusing to regenerate glue; existing glue left untouched`,
		);
	}
	const dirNames = fs
		.readdirSync(storePath, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	if (dirNames.length === 0) {
		throw new SkillGlueError(
			`skill store at ${STORE_DIR}/ has no skills — refusing to regenerate glue; existing glue left untouched`,
		);
	}
	return dirNames.map((dirName) => readSkill(root, dirName));
}
