import fs from "node:fs";
import {
	FrontmatterError,
	parseFrontmatter,
	type YamlValue,
} from "../lib/frontmatter.ts";
import type { Vault } from "./vault.ts";
import { buildLinkIndex, extractWikilinks } from "./wikilinks.ts";

export type Rule = "frontmatter" | "kebab-case" | "wikilink" | "secrets";

export interface Violation {
	/** Vault-relative POSIX path. */
	file: string;
	rule: Rule;
	message: string;
	line?: number;
}

function violation(
	file: string,
	rule: Rule,
	message: string,
	line?: number,
): Violation {
	const v: Violation = { file, rule, message };
	if (line !== undefined) v.line = line;
	return v;
}

/** 1-based line of the `key:` entry in a frontmatter block, if present. */
function keyLine(source: string, key: string): number | undefined {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	for (let i = 0; i < lines.length; i++) {
		if (new RegExp(`^${key}\\s*:`).test(lines[i] ?? "")) return i + 1;
	}
	return undefined;
}

const DATE =
	/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * The #7 schema: every note carries `tags` (list, may be empty) and
 * `created` (date); `draft` is an optional boolean.
 */
export function checkFrontmatter(vault: Vault): Violation[] {
	const violations: Violation[] = [];
	for (const note of vault.notes) {
		const source = fs.readFileSync(note.absolutePath, "utf8");
		let fields: Record<string, YamlValue>;
		try {
			const parsed = parseFrontmatter(source, note.relativePath);
			if (parsed === null) {
				violations.push(
					violation(
						note.relativePath,
						"frontmatter",
						'missing frontmatter — every note needs "tags" and "created"',
						1,
					),
				);
				continue;
			}
			fields = parsed.fields;
		} catch (error) {
			if (error instanceof FrontmatterError) {
				violations.push(
					violation(
						note.relativePath,
						"frontmatter",
						`invalid frontmatter: ${error.message}`,
						1,
					),
				);
				continue;
			}
			throw error;
		}

		const tags = fields.tags;
		if (tags === undefined) {
			violations.push(
				violation(
					note.relativePath,
					"frontmatter",
					'missing required field "tags" (list, may be empty)',
				),
			);
		} else if (!Array.isArray(tags)) {
			violations.push(
				violation(
					note.relativePath,
					"frontmatter",
					'"tags" must be a list (may be empty)',
					keyLine(source, "tags"),
				),
			);
		}

		const created = fields.created;
		if (created === undefined) {
			violations.push(
				violation(
					note.relativePath,
					"frontmatter",
					'missing required field "created" (date, YYYY-MM-DD)',
				),
			);
		} else if (typeof created !== "string" || !DATE.test(created)) {
			violations.push(
				violation(
					note.relativePath,
					"frontmatter",
					'"created" must be a date (YYYY-MM-DD)',
					keyLine(source, "created"),
				),
			);
		}

		const draft = fields.draft;
		if (draft !== undefined && typeof draft !== "boolean") {
			violations.push(
				violation(
					note.relativePath,
					"frontmatter",
					'"draft" must be a boolean',
					keyLine(source, "draft"),
				),
			);
		}
	}
	return violations;
}

const KEBAB_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)+$/;

/** Kebab-case filenames (#6) for notes, drawings and images. */
export function checkKebabCase(vault: Vault): Violation[] {
	const violations: Violation[] = [];
	const files = [...vault.notes, ...vault.drawings, ...vault.images];
	for (const file of files) {
		const name = file.relativePath.slice(
			file.relativePath.lastIndexOf("/") + 1,
		);
		if (!KEBAB_FILE.test(name)) {
			violations.push(
				violation(
					file.relativePath,
					"kebab-case",
					`filename "${name}" is not kebab-case`,
				),
			);
		}
	}
	return violations;
}

/** Every `[[target]]` / `![[target]]` in a note must resolve (#7). */
export function checkWikilinks(vault: Vault): Violation[] {
	const index = buildLinkIndex(vault);
	const violations: Violation[] = [];
	for (const note of vault.notes) {
		const source = fs.readFileSync(note.absolutePath, "utf8");
		for (const link of extractWikilinks(source)) {
			if (!index.resolve(link.target)) {
				violations.push(
					violation(
						note.relativePath,
						"wikilink",
						`unresolved ${link.embed ? "embed" : "wikilink"} target "${link.target}"`,
						link.line,
					),
				);
			}
		}
	}
	return violations;
}

const TOKEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
	{ name: "GitHub token", pattern: /ghp_[A-Za-z0-9]{20,}/ },
	{ name: "GitHub token", pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
	{ name: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}/ },
];

const SECRET_KEY =
	/"([^"]*(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key)[^"]*)"\s*:\s*"[A-Za-z0-9_\-+/=.]{16,}"/i;

/**
 * The #16 backstop: no token- or credential-looking values in committable
 * `.obsidian/` config. Workspace state and caches are excluded by scanVault;
 * secrets belong in Secret Storage or a gitignored data.json.
 */
export function checkSecrets(vault: Vault): Violation[] {
	const violations: Violation[] = [];
	for (const config of vault.obsidianConfigs) {
		const source = fs.readFileSync(config.absolutePath, "utf8");
		const lines = source.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			for (const { name, pattern } of TOKEN_PATTERNS) {
				if (pattern.test(line)) {
					violations.push(
						violation(
							config.relativePath,
							"secrets",
							`${name}-looking value in committable .obsidian config — secrets must never be committed (#16)`,
							i + 1,
						),
					);
				}
			}
			const keyMatch = SECRET_KEY.exec(line);
			if (keyMatch) {
				violations.push(
					violation(
						config.relativePath,
						"secrets",
						`key "${keyMatch[1]}" holds a credential-looking value in committable .obsidian config — secrets must never be committed (#16)`,
						i + 1,
					),
				);
			}
		}
	}
	return violations;
}
