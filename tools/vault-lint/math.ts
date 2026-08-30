/**
 * Math-delimiter forms that Obsidian renders and Quartz does not.
 *
 * Obsidian's MathJax is permissive about where `$$` sits and about a few TeX
 * spellings. Quartz's remark-math and KaTeX are not, so source that looks
 * correct in the editor can render as a wall of red parse errors on the site.
 * The failures are silent locally — the note looks right — which is what makes
 * them worth a lint rule rather than a style preference.
 *
 * Four forms are caught, each verified against the real Quartz build:
 *
 * - `display-open-meta`: `$$` with content trailing on the same line, as in
 *   `$$\begin{aligned}`. remark-math reads everything after the opening `$$`
 *   as the block's *meta* string and discards it, so the `\begin` is lost.
 * - `display-close-meta`: content leading into a closing `$$`, as in
 *   `\end{aligned}$$`. A closing fence must be `$$` alone, so this does not
 *   close the block at all — it runs on until the next bare `$$`, swallowing
 *   whatever prose lies between and knocking every later block out of phase.
 * - `display-in-paragraph`: a whole `$$…$$` inside a sentence. Both renderers
 *   break the paragraph into three pieces around it; inline math wants `$…$`.
 * - `prime-after-space`: `\,'` — a prime directly after a spacing command.
 *   MathJax renders it; KaTeX raises `Got group of unknown type: 'internal'`
 *   because there is no atom for the prime to attach to. `\,{}'` supplies the
 *   empty group both engines accept.
 *
 * Every form has a mechanical rewrite, so all four are autofixable and
 * `fixMath` is the counterpart to `findMathProblems` — same detection, applied
 * instead of reported.
 *
 * Fenced code blocks are skipped: a fence may legitimately show any of these
 * as example text. Inline code spans are not tracked, matching the same known
 * limitation in `tools/lib/math-blocks.ts`.
 */

export type MathIssue =
	| "display-open-meta"
	| "display-close-meta"
	| "display-in-paragraph"
	| "prime-after-space";

export interface MathProblem {
	/** 1-based line number in the source. */
	line: number;
	issue: MathIssue;
	message: string;
}

/** Opens or closes a fenced code block: ``` or ~~~, optionally indented. */
const FENCE = /^\s*(`{3,}|~{3,})/;

/** A prime straight after a spacing command, which KaTeX cannot attach. */
const PRIME_AFTER_SPACE = "\\,'";
const PRIME_FIXED = "\\,{}'";

/** `$$…$$` with no newline between the delimiters. */
const INLINE_DISPLAY = /\$\$([^\n]*?)\$\$/g;

const MESSAGES: Record<MathIssue, string> = {
	"display-open-meta":
		"`$$` carries content on its opening line, which remark-math discards as the block's meta string — put the `$$` on a line of its own",
	"display-close-meta":
		"`$$` closes on a line that starts with content, which does not close the block at all — it runs on and swallows the text that follows, so put the `$$` on a line of its own",
	"display-in-paragraph":
		"display `$$…$$` sits inside a sentence, which splits the paragraph around it in both renderers — use inline `$…$`",
	"prime-after-space":
		"`\\,'` renders in Obsidian's MathJax but is a KaTeX parse error on the site (no atom for the prime to attach to) — write `\\,{}'`",
};

function problem(line: number, issue: MathIssue): MathProblem {
	return { line, issue, message: MESSAGES[issue] };
}

/**
 * A closing fence must use the same character as the opener and be at least
 * as long, per CommonMark.
 */
function closesFence(open: string, candidate: string): boolean {
	return candidate[0] === open[0] && candidate.length >= open.length;
}

/**
 * Which structural `$$` problem a line has, if any. A line holding a complete
 * `$$…$$` pair is a single-line display: it is only a problem when prose sits
 * beside it, since `promoteDisplayMath` already lifts the standalone form into
 * a proper block at build time.
 */
function displayIssue(
	line: string,
): "display-open-meta" | "display-close-meta" | "display-in-paragraph" | null {
	const first = line.indexOf("$$");
	if (first === -1) return null;
	const last = line.lastIndexOf("$$");

	if (first !== last) {
		const outside = line.slice(0, first) + line.slice(last + 2);
		return outside.trim() === "" ? null : "display-in-paragraph";
	}

	const before = line.slice(0, first).trim();
	const after = line.slice(first + 2).trim();
	if (before === "" && after !== "") return "display-open-meta";
	if (before !== "" && after === "") return "display-close-meta";
	return null;
}

/** Rewrites the one line a structural issue was found on. */
function fixLine(line: string, issue: MathIssue): string[] {
	const first = line.indexOf("$$");
	switch (issue) {
		case "display-open-meta":
			return ["$$", line.slice(first + 2).trim()];
		case "display-close-meta":
			return [line.slice(0, first).trimEnd(), "$$"];
		case "display-in-paragraph":
			return [line.replace(INLINE_DISPLAY, (_all, inner) => `$${inner}$`)];
		case "prime-after-space":
			return [line];
	}
}

/**
 * Walks `source` line by line, skipping fenced code, and hands each content
 * line to `visit` along with its 1-based number. Shared by the reporting and
 * rewriting passes so the two can never disagree about what counts.
 */
function eachContentLine(
	source: string,
	visit: (line: string, number: number) => void,
): void {
	let fence: string | null = null;
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const fenceMatch = FENCE.exec(line);

		if (fence !== null) {
			if (fenceMatch !== null && closesFence(fence, fenceMatch[1] ?? ""))
				fence = null;
			continue;
		}
		if (fenceMatch !== null) {
			fence = fenceMatch[1] ?? null;
			continue;
		}
		visit(line, i + 1);
	}
}

/** Every math-delimiter problem in `source`, in line order. */
export function findMathProblems(source: string): MathProblem[] {
	const problems: MathProblem[] = [];
	eachContentLine(source.replace(/\r\n/g, "\n"), (line, number) => {
		if (line.includes(PRIME_AFTER_SPACE))
			problems.push(problem(number, "prime-after-space"));
		const issue = displayIssue(line);
		if (issue !== null) problems.push(problem(number, issue));
	});
	return problems;
}

/**
 * Applies the rewrite for every problem `findMathProblems` reports. Returns
 * `source` unchanged when there is nothing to fix, so a caller can compare by
 * identity to decide whether a write is needed.
 *
 * CRLF input is normalised to LF, matching how the notes are stored.
 */
export function fixMath(source: string): string {
	const normalised = source.replace(/\r\n/g, "\n");
	const out: string[] = [];
	let changed = false;
	let fence: string | null = null;

	for (const original of normalised.split("\n")) {
		const fenceMatch = FENCE.exec(original);

		if (fence !== null) {
			out.push(original);
			if (fenceMatch !== null && closesFence(fence, fenceMatch[1] ?? ""))
				fence = null;
			continue;
		}
		if (fenceMatch !== null) {
			fence = fenceMatch[1] ?? null;
			out.push(original);
			continue;
		}

		let line = original;
		if (line.includes(PRIME_AFTER_SPACE))
			line = line.split(PRIME_AFTER_SPACE).join(PRIME_FIXED);

		const issue = displayIssue(line);
		const produced = issue === null ? [line] : fixLine(line, issue);
		if (produced.length !== 1 || produced[0] !== original) changed = true;
		out.push(...produced);
	}

	return changed ? out.join("\n") : source;
}
