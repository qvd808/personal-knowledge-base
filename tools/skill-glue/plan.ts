import { SkillGlueError } from "./errors.ts";
import { GLUE_DIR, type Skill } from "./store.ts";

export const AGENTS_MD = "AGENTS.md";
export const BEGIN_MARKER =
	"<!-- BEGIN GENERATED skill-glue: do not edit between these markers -->";
export const END_MARKER = "<!-- END GENERATED skill-glue -->";

export interface GluePlan {
	/** Repo-relative POSIX path → desired content, for every generated skill file. */
	skillFiles: Map<string, Buffer>;
	/** Names of enabled skills; the generator owns `.claude/skills/<name>/` for these. */
	skillDirs: string[];
	/** Full desired content of AGENTS.md. */
	agentsMd: string;
}

export function flattenDescription(description: string): string {
	return description.replace(/\s+/g, " ").trim();
}

function renderSection(enabled: Skill[]): string {
	const lines = [
		BEGIN_MARKER,
		"",
		"## Skills",
		"",
		"Generated from `.agents/skills/` by `npm run glue`; do not edit by hand.",
		"",
		...enabled.map(
			(skill) =>
				`- **${skill.name}** — ${flattenDescription(skill.description)}`,
		),
		"",
		END_MARKER,
	];
	return lines.join("\n");
}

const MINIMAL_AGENTS_MD = [
	"# AGENTS.md",
	"",
	"Agent navigation contract for this repository; see `ARCHITECTURE.md` for the system spec.",
	"",
].join("\n");

/**
 * Splices the generated section into existing AGENTS.md content. Everything
 * outside the markers is preserved byte-for-byte; a file without markers gets
 * the section appended; unbalanced markers are an error, never a clobber.
 */
export function renderAgentsMd(
	existing: string | null,
	enabled: Skill[],
): string {
	const section = renderSection(enabled);
	if (existing === null) {
		return `${MINIMAL_AGENTS_MD}\n${section}\n`;
	}
	const text = existing.replace(/\r\n/g, "\n");
	const begin = text.indexOf(BEGIN_MARKER);
	const end = text.indexOf(END_MARKER);
	if (begin === -1 && end === -1) {
		const separator = text.endsWith("\n") ? "\n" : "\n\n";
		return `${text}${separator}${section}\n`;
	}
	if (begin === -1 || end === -1 || end < begin) {
		throw new SkillGlueError(
			`${AGENTS_MD} has unbalanced skill-glue markers — fix or remove the markers by hand`,
		);
	}
	const before = text.slice(0, begin);
	const after = text.slice(end + END_MARKER.length);
	const beforeNorm =
		before === "" || before.endsWith("\n") ? before : `${before}\n`;
	const afterNorm =
		after === "" || after.startsWith("\n") ? after : `\n${after}`;
	return `${beforeNorm}${section}${afterNorm}`;
}

/**
 * Pure desired-state computation: which glue files should exist and what
 * AGENTS.md should say. No disk writes happen here.
 */
export function buildPlan(
	skills: Skill[],
	existingAgentsMd: string | null,
): GluePlan {
	const enabled = skills
		.filter((skill) => !skill.disabled)
		.sort((a, b) => a.name.localeCompare(b.name));
	const skillFiles = new Map<string, Buffer>();
	const skillDirs: string[] = [];
	for (const skill of enabled) {
		skillDirs.push(skill.name);
		for (const file of skill.files) {
			skillFiles.set(
				`${GLUE_DIR}/${skill.name}/${file.relativePath}`,
				file.content,
			);
		}
	}
	return {
		skillFiles,
		skillDirs,
		agentsMd: renderAgentsMd(existingAgentsMd, enabled),
	};
}
