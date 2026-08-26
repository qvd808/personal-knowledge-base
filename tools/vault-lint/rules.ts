import fs from "node:fs";
import {
	FrontmatterError,
	parseFrontmatter,
	type YamlValue,
} from "../lib/frontmatter.ts";
import type { Vault } from "../lib/vault.ts";
import {
	type BlockReference,
	extractBlockIds,
	extractBlockReferences,
	suggestedSpelling,
} from "./anchors.ts";
import { buildLinkIndex, extractWikilinks } from "./wikilinks.ts";

export type Rule =
	| "frontmatter"
	| "kebab-case"
	| "wikilink"
	| "secrets"
	| "block-anchor";

export interface Violation {
	/** Vault-relative POSIX path. */
	file: string;
	rule: Rule;
	message: string;
	line?: number;
}

/** Rules reported at the findings tier: never blocking, never editing. */
export type FindingRule = "block-anchor-target";

export interface Finding {
	/** Vault-relative POSIX path. */
	file: string;
	rule: FindingRule;
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
 * secrets belong in Secret Storage or a gitignored data.json. Only JSON config
 * is scanned — third-party plugin code (main.js, styles.css) is public release
 * artifacts and false-positives on minified identifiers.
 */
export function checkSecrets(vault: Vault): Violation[] {
	const violations: Violation[] = [];
	for (const config of vault.obsidianConfigs) {
		if (!config.relativePath.endsWith(".json")) continue;
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

/** `a/b/note.md` -> `note`: the name a wikilink uses to reach the note. */
function noteName(relativePath: string): string {
	return relativePath
		.slice(relativePath.lastIndexOf("/") + 1)
		.replace(/\.md$/i, "");
}

/** Whether a block reference points back at the note that contains it. */
function pointsAtOwnNote(ref: BlockReference, relativePath: string): boolean {
	if (ref.note === null) return false;
	const target = ref.note.replace(/\.md$/i, "").toLowerCase();
	return (
		target === noteName(relativePath).toLowerCase() ||
		target === relativePath.replace(/\.md$/i, "").toLowerCase()
	);
}

/**
 * Every block reference must name a note (#46). Quartz strips the caret only
 * on hrefs that do, so `[text](#^id)` and `[[#^id]]` both render as dead links
 * on the published site. Blocking, not a finding: the output is broken with no
 * judgment call to make. Heading anchors carry no caret and are untouched.
 */
export function checkBlockAnchors(vault: Vault): Violation[] {
	const violations: Violation[] = [];
	for (const note of vault.notes) {
		const source = fs.readFileSync(note.absolutePath, "utf8");
		const name = noteName(note.relativePath);
		for (const ref of extractBlockReferences(source)) {
			if (ref.note !== null) continue;
			violations.push(
				violation(
					note.relativePath,
					"block-anchor",
					`block reference "#^${ref.id}" names no note, so Quartz keeps the caret and the link is dead on the site — write ${suggestedSpelling(name, ref)}`,
					ref.line,
				),
			);
		}
	}
	return violations;
}

/**
 * A block reference back into its own note should point at a block that
 * exists (#46). Reported as a finding: a missing marker is a broken link but
 * a renamed one is usually mid-edit, and lint blocking on it would fight the
 * writer. Cross-note references are out of scope here, so this never overlaps
 * the registry rule for `[[resources#^res-...]]`.
 */
export function checkBlockAnchorTargets(vault: Vault): Finding[] {
	const findings: Finding[] = [];
	for (const note of vault.notes) {
		const source = fs.readFileSync(note.absolutePath, "utf8");
		const ids = extractBlockIds(source);
		for (const ref of extractBlockReferences(source)) {
			if (!pointsAtOwnNote(ref, note.relativePath)) continue;
			if (ids.has(ref.id)) continue;
			const finding: Finding = {
				file: note.relativePath,
				rule: "block-anchor-target",
				message: `block reference "#^${ref.id}" points at no block in this note — no "^${ref.id}" marker found`,
			};
			if (ref.line !== undefined) finding.line = ref.line;
			findings.push(finding);
		}
	}
	return findings;
}
