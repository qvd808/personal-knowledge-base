/**
 * Minimal YAML-frontmatter parser covering the agentskills.io portable core
 * (#10) and the Vault note schema (#7): top-level keys, one-or-deeper nested
 * maps (`metadata:`), folded (`>`) and literal (`|`) block scalars, dash lists
 * and flow lists, quoted/plain scalars, booleans and null. It is deliberately
 * not a general YAML parser; anything outside this subset is a parse error,
 * not a guess.
 */

/**
 * Malformed frontmatter. Callers decide whether that is a hard error
 * (skill-glue) or a rule violation (vault-lint).
 */
export class FrontmatterError extends Error {}

export type YamlValue =
	| string
	| boolean
	| null
	| YamlValue[]
	| { [key: string]: YamlValue };

export interface ParsedFrontmatter {
	fields: Record<string, YamlValue>;
	/** Everything after the closing fence. */
	body: string;
}

export interface SkillFrontmatter {
	name: string;
	description: string;
	disabled: boolean;
	fields: Record<string, YamlValue>;
}

const FENCE = "---";

interface Cursor {
	lines: string[];
	i: number;
}

function isBlank(line: string): boolean {
	return line.trim() === "";
}

function isComment(line: string): boolean {
	return line.trimStart().startsWith("#");
}

function indentOf(line: string, filePath: string): number {
	const match = /^ */.exec(line);
	const indent = match?.[0].length ?? 0;
	if (line[indent] === "\t") {
		throw new FrontmatterError(
			`${filePath}: tab indentation is not valid in frontmatter`,
		);
	}
	return indent;
}

function peekContentLine(cursor: Cursor): string | undefined {
	for (let j = cursor.i; j < cursor.lines.length; j++) {
		const line = cursor.lines[j];
		if (line !== undefined && !isBlank(line) && !isComment(line)) {
			return line;
		}
	}
	return undefined;
}

function parseScalar(raw: string): YamlValue {
	const value = raw.trim();
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null" || value === "~" || value === "") return null;
	if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
		return value.slice(1, -1).replace(/''/g, "'");
	}
	if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
		return value
			.slice(1, -1)
			.replace(/\\n/g, "\n")
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\");
	}
	return value;
}

function parseFlowList(raw: string, filePath: string): YamlValue[] {
	const inner = raw.slice(1, -1).trim();
	if (inner === "") return [];
	return inner.split(",").map((item) => {
		const value = parseScalar(item);
		if (value === null || typeof value === "object") {
			throw new FrontmatterError(
				`${filePath}: unsupported flow-list item "${item.trim()}"`,
			);
		}
		return value;
	});
}

const BLOCK_SCALAR = /^([>|])([+-]?)$/;

function parseBlockScalar(
	indicator: string,
	cursor: Cursor,
	parentIndent: number,
	filePath: string,
): string {
	const match = BLOCK_SCALAR.exec(indicator);
	if (!match) {
		throw new FrontmatterError(
			`${filePath}: unsupported block scalar indicator "${indicator}"`,
		);
	}
	const literal = match[1] === "|";
	const collected: string[] = [];
	let blockIndent = -1;
	while (cursor.i < cursor.lines.length) {
		const line = cursor.lines[cursor.i];
		if (line === undefined) break;
		if (isBlank(line)) {
			collected.push("");
			cursor.i++;
			continue;
		}
		const indent = indentOf(line, filePath);
		if (indent <= parentIndent) break;
		if (blockIndent === -1) blockIndent = indent;
		collected.push(line.slice(Math.min(blockIndent, line.length)));
		cursor.i++;
	}
	while (collected.length > 0 && collected[collected.length - 1] === "") {
		collected.pop();
	}
	if (literal) {
		return collected.join("\n");
	}
	// Folded: lines in a paragraph join with spaces; blank lines split paragraphs.
	const paragraphs: string[] = [];
	let current = "";
	for (const line of collected) {
		if (line === "") {
			if (current !== "") paragraphs.push(current);
			current = "";
		} else {
			current = current === "" ? line : `${current} ${line}`;
		}
	}
	if (current !== "") paragraphs.push(current);
	return paragraphs.join("\n");
}

function parseList(
	cursor: Cursor,
	indent: number,
	filePath: string,
): YamlValue[] {
	const items: YamlValue[] = [];
	while (cursor.i < cursor.lines.length) {
		const line = cursor.lines[cursor.i];
		if (line === undefined) break;
		if (isBlank(line) || isComment(line)) {
			cursor.i++;
			continue;
		}
		const lineIndent = indentOf(line, filePath);
		if (lineIndent < indent) break;
		const trimmed = line.slice(lineIndent);
		if (lineIndent !== indent || !trimmed.startsWith("- ")) {
			throw new FrontmatterError(
				`${filePath}: unsupported nested list item "${trimmed}"`,
			);
		}
		const value = parseScalar(trimmed.slice(2));
		if (value === null || typeof value === "object") {
			throw new FrontmatterError(
				`${filePath}: unsupported list item "${trimmed}"`,
			);
		}
		items.push(value);
		cursor.i++;
	}
	return items;
}

const KEY_LINE = /^([A-Za-z0-9_-]+):(?: +(.*))?$/;

function parseMap(
	cursor: Cursor,
	indent: number,
	filePath: string,
): Record<string, YamlValue> {
	const map: Record<string, YamlValue> = {};
	while (cursor.i < cursor.lines.length) {
		const line = cursor.lines[cursor.i];
		if (line === undefined) break;
		if (isBlank(line) || isComment(line)) {
			cursor.i++;
			continue;
		}
		const lineIndent = indentOf(line, filePath);
		if (lineIndent < indent) break;
		if (lineIndent > indent) {
			throw new FrontmatterError(
				`${filePath}: unexpected indentation in "${line.trim()}"`,
			);
		}
		const match = KEY_LINE.exec(line.slice(lineIndent));
		if (!match) {
			throw new FrontmatterError(
				`${filePath}: cannot parse frontmatter line "${line.trim()}"`,
			);
		}
		const key = match[1];
		const inline = match[2];
		if (key === undefined) break;
		cursor.i++;
		if (inline !== undefined && inline !== "") {
			if (BLOCK_SCALAR.test(inline)) {
				map[key] = parseBlockScalar(inline, cursor, lineIndent, filePath);
			} else if (inline.startsWith("[") && inline.endsWith("]")) {
				map[key] = parseFlowList(inline, filePath);
			} else {
				map[key] = parseScalar(inline);
			}
			continue;
		}
		const next = peekContentLine(cursor);
		if (next !== undefined && indentOf(next, filePath) > lineIndent) {
			const nextIndent = indentOf(next, filePath);
			map[key] = next.trimStart().startsWith("- ")
				? parseList(cursor, nextIndent, filePath)
				: parseMap(cursor, nextIndent, filePath);
		} else {
			map[key] = null;
		}
	}
	return map;
}

/**
 * Parses the frontmatter block of any Markdown file. Returns null when the
 * file has no frontmatter at all; throws FrontmatterError when a block is
 * present but malformed.
 */
export function parseFrontmatter(
	source: string,
	filePath: string,
): ParsedFrontmatter | null {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	if (lines[0] !== FENCE) {
		return null;
	}
	let end = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trimEnd() === FENCE) {
			end = i;
			break;
		}
	}
	if (end === -1) {
		throw new FrontmatterError(
			`${filePath}: missing closing --- frontmatter fence`,
		);
	}
	const cursor: Cursor = { lines: lines.slice(1, end), i: 0 };
	const fields = parseMap(cursor, 0, filePath);
	return { fields, body: lines.slice(end + 1).join("\n") };
}

export function parseSkillMd(
	source: string,
	filePath: string,
): SkillFrontmatter {
	const parsed = parseFrontmatter(source, filePath);
	if (parsed === null) {
		throw new FrontmatterError(
			`${filePath}: SKILL.md must start with a --- frontmatter fence`,
		);
	}
	const { fields } = parsed;

	const name = fields.name;
	if (typeof name !== "string" || name === "") {
		throw new FrontmatterError(
			`${filePath}: frontmatter requires a non-empty "name"`,
		);
	}
	const description = fields.description;
	if (typeof description !== "string" || description.trim() === "") {
		throw new FrontmatterError(
			`${filePath}: frontmatter requires a non-empty "description"`,
		);
	}
	const metadata = fields.metadata;
	const disabled =
		metadata !== null &&
		typeof metadata === "object" &&
		!Array.isArray(metadata) &&
		metadata.disabled === true;

	return { name, description, disabled, fields };
}
