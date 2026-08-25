/**
 * The wordlist (#40 §4): one plain-text file, one entry per line, `#`
 * comments, blank lines ignored. A line containing `->` is a swap pair
 * (`wrong->right`); every other non-comment line is an exempt word that is
 * never suspicious. Growth = edit the file directly.
 */

export interface SwapPair {
	wrong: string;
	right: string;
}

export interface Wordlist {
	/** Lowercased wrong form → right form, as written. */
	swaps: Map<string, string>;
	/** Lowercased exempt words. */
	exempt: Set<string>;
}

export interface WordlistParse {
	wordlist: Wordlist;
	/** Malformed lines with their 1-based line numbers — infrastructure errors. */
	errors: string[];
}

const SEPARATOR = "->";

export function parseWordlist(text: string): WordlistParse {
	const swaps = new Map<string, string>();
	const exempt = new Set<string>();
	const errors: string[] = [];

	for (const [index, raw] of text
		.replace(/\r\n/g, "\n")
		.split("\n")
		.entries()) {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) continue;
		const lineNumber = index + 1;

		const separator = line.indexOf(SEPARATOR);
		if (separator === -1) {
			exempt.add(line.toLowerCase());
			continue;
		}

		const wrong = line.slice(0, separator).trim();
		const right = line.slice(separator + SEPARATOR.length).trim();
		if (wrong === "" || right === "") {
			errors.push(`wordlist line ${lineNumber}: empty side of a swap pair`);
			continue;
		}
		const key = wrong.toLowerCase();
		const existing = swaps.get(key);
		if (existing !== undefined && existing !== right) {
			errors.push(
				`wordlist line ${lineNumber}: "${wrong}" is already mapped to "${existing}"`,
			);
			continue;
		}
		swaps.set(key, right);
	}

	return { wordlist: { swaps, exempt }, errors };
}
