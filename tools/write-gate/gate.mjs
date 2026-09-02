#!/usr/bin/env node
/**
 * Write gate — one implementation, two harnesses.
 *
 * What it is for: the author reviews every change to this repository's content
 * before an agent makes it. Nothing else is the point. Running the app, running
 * tests, reading status, driving the issue tracker with `gh`, installing
 * dependencies, writing to a scratchpad outside the repo — none of that alters
 * what is under review, so none of it is gated. The rule is stated for humans
 * and agents in `AGENTS.md` ("Write gate") and `CLAUDE.md`; this script is what
 * makes it binding rather than advisory, for agents that would otherwise just
 * decide not to follow it.
 *
 * Modes, each wired to a hook event in both harnesses:
 *
 *   prompt   — reads the user's own message. The phrase, and only the phrase,
 *              opens the gate: the approval marker is written when it is
 *              present and removed when it is not. Because the marker derives
 *              from the user's text and is rewritten on every message, an agent
 *              cannot forge approval and approval cannot survive into the next
 *              turn.
 *   tool     — reads a pending tool call. Denies file edits and shell commands
 *              that would change repository content, unless approval is active;
 *              denies `docs/knowledge/` writes unless the `knowledge-note`
 *              skill is open. Also detects the Skill tool opening that skill.
 *   session  — clears the skill marker, so an open skill never outlives the
 *              session that opened it.
 *   open     — records the `knowledge-note` skill as open. For harnesses with
 *              no skill concept of their own; run as `npm run gate:note`.
 *
 * Usage: node gate.mjs <claude|cursor> <prompt|tool|session|open>
 * Input: the harness's hook payload as JSON on stdin (ignored by session/open).
 * Output: a deny decision as JSON on stdout, or nothing at all to stay out of
 *         the way — silence leaves the harness's own permission flow untouched,
 *         so this gate can only ever subtract permission, never grant it.
 *
 * Shell commands are judged by what they do, not by the words they contain: the
 * command line is tokenised, split into segments, and each segment is read for
 * a writing command word or a redirect whose target lands inside the repository.
 * A verb inside a quoted string is text. A write aimed outside the repo is not
 * this gate's business.
 *
 * What it does not cover, stated plainly because an unknown hole is worse than
 * a documented one: a write smuggled through an interpreter (`python -c`,
 * `node -e`), an encoded payload, or a script invoked by name that writes as a
 * side effect. Those are violations of the contract in `AGENTS.md`, not
 * permitted routes.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** The approval phrase, matched case-insensitively and whitespace-insensitively. */
const PHRASE = "for the love of everything, please edit, please help me";

/** The skill that owns the `docs/knowledge/` exception. */
const NOTE_SKILL = "knowledge-note";

/**
 * Repo-relative path prefixes the note skill may write without the phrase — the
 * standing exception in `CLAUDE.md`. Directories only; keep the trailing slash.
 */
const SKILL_WRITABLE = ["docs/knowledge/"];

/** Tool names that edit files. */
const EDIT_TOOL = /edit|write|create|delete|remove|patch|apply|move|rename/i;

/** Tool names that run a shell command. */
const SHELL_TOOL = /^(bash|shell|powershell|terminal|run_?command|exec)/i;

/** Tool names that invoke a skill. */
const SKILL_TOOL = /^skill$/i;

/** Keys in a tool payload whose value is a filesystem path. */
const PATH_KEY = /(^|_)(path|file|filename)s?$/i;

/**
 * Command words that write wherever their arguments point. Anything not listed
 * here is allowed: the default is to let tooling run, and only these — plus a
 * redirect, plus the git subcommands below — are treated as content changes.
 */
const WRITE_COMMANDS = new Set([
	"cp",
	"mv",
	"rm",
	"rmdir",
	"mkdir",
	"touch",
	"truncate",
	"ln",
	"chmod",
	"chown",
	"unlink",
	"tee",
	"dd",
	"set-content",
	"add-content",
	"out-file",
	"new-item",
	"remove-item",
	"move-item",
	"copy-item",
	"clear-content",
	"rename-item",
]);

/**
 * Commands that write only when asked to edit in place. Their first non-flag
 * argument is the script, not a path, so it is skipped when looking for targets.
 */
const IN_PLACE_COMMANDS = new Set(["sed", "perl", "ruby"]);

/** git subcommands that change tracked content, the index, or the remote. */
const GIT_WRITE = new Set([
	"add",
	"commit",
	"apply",
	"am",
	"mv",
	"rm",
	"cherry-pick",
	"revert",
	"merge",
	"rebase",
	"push",
]);

/**
 * git subcommands that discard uncommitted work. `CLAUDE.md` bans these
 * outright, so approval does not unlock them: the author's uncommitted changes
 * are not something an approval phrase was meant to authorise destroying.
 */
const GIT_DISCARD = new Set(["checkout", "restore", "reset", "clean", "stash"]);

/** Redirect targets that go nowhere, so they are never repository writes. */
const NULL_SINKS = new Set(["/dev/null", "$null", "nul", "NUL", "/dev/stdout"]);

/** Shell operators that end one command segment and begin another. */
const SEGMENT_OPERATORS = new Set(["|", "||", "&&", ";", "&"]);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

/**
 * Markers live inside .git/ so they are never committed and never appear in
 * git status. Per agent, so approval given to one does not silently open the
 * gate for another running at the same time.
 */
function markerPath(agent, kind) {
	return path.join(REPO_ROOT, ".git", "write-gate", `${kind}-${agent}.json`);
}

function readMarker(agent, kind) {
	return fs.existsSync(markerPath(agent, kind));
}

function writeMarker(agent, kind, detail) {
	const file = markerPath(agent, kind);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(
		file,
		`${JSON.stringify({ agent, kind, at: new Date().toISOString(), ...detail }, null, 2)}\n`,
		"utf8",
	);
}

function clearMarker(agent, kind) {
	try {
		fs.rmSync(markerPath(agent, kind), { force: true });
	} catch {
		process.stderr.write(`write-gate: could not clear the ${kind} marker\n`);
	}
}

function readStdin() {
	try {
		return fs.readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function parsePayload() {
	const raw = readStdin().trim();
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function normalise(text) {
	return String(text ?? "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

/** Every string under a path-ish key, however deeply nested. */
function collectPaths(value, keyMatched, out) {
	if (typeof value === "string") {
		if (keyMatched) out.push(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectPaths(item, keyMatched, out);
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, nested] of Object.entries(value)) {
			collectPaths(nested, keyMatched || PATH_KEY.test(key), out);
		}
	}
}

/** Repo-relative and forward-slashed, or null when the path is not in the repo. */
function toRepoRelative(candidate) {
	const trimmed = String(candidate).trim();
	if (!trimmed || NULL_SINKS.has(trimmed)) return null;
	let absolute;
	try {
		absolute = path.isAbsolute(trimmed)
			? trimmed
			: path.resolve(REPO_ROOT, trimmed);
	} catch {
		return null;
	}
	const relative = path.relative(REPO_ROOT, absolute);
	if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
		return null;
	}
	return relative.split(path.sep).join("/");
}

function isSkillWritable(relativePath) {
	return SKILL_WRITABLE.some((prefix) => relativePath.startsWith(prefix));
}

/**
 * Splits a command line into tokens, keeping track of which were quoted so a
 * write verb inside a string is never mistaken for a command. Operators come
 * back as their own tokens.
 */
function tokenize(command) {
	const tokens = [];
	let current = "";
	let started = false;
	let quoted = false;
	let quote = null;

	const flush = () => {
		if (started) tokens.push({ value: current, quoted });
		current = "";
		started = false;
		quoted = false;
	};

	for (let i = 0; i < command.length; i += 1) {
		const char = command[i];
		if (quote) {
			if (char === quote) quote = null;
			else current += char;
			started = true;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			quoted = true;
			started = true;
			continue;
		}
		if (/\s/.test(char)) {
			flush();
			continue;
		}
		if (
			char === "|" ||
			char === "&" ||
			char === ";" ||
			char === ">" ||
			char === "<"
		) {
			flush();
			let operator = char;
			while (
				command[i + 1] === char &&
				(char === ">" || char === "<" || char === "|" || char === "&")
			) {
				operator += command[i + 1];
				i += 1;
			}
			tokens.push({ value: operator, operator: true });
			continue;
		}
		current += char;
		started = true;
	}
	flush();
	return tokens;
}

/** One command segment: its words, and the targets of any output redirects. */
function splitSegments(tokens) {
	const segments = [];
	let words = [];
	let redirects = [];
	let expectRedirect = false;

	const flush = () => {
		if (words.length > 0 || redirects.length > 0) {
			segments.push({ words, redirects });
		}
		words = [];
		redirects = [];
	};

	for (const token of tokens) {
		if (token.operator) {
			if (SEGMENT_OPERATORS.has(token.value)) {
				flush();
				expectRedirect = false;
				continue;
			}
			expectRedirect = token.value.startsWith(">");
			continue;
		}
		if (expectRedirect) {
			redirects.push(token.value);
			expectRedirect = false;
			continue;
		}
		words.push(token);
	}
	flush();
	return segments;
}

/** The command word, with any leading path and `VAR=value` prefixes removed. */
function commandWord(words) {
	for (const word of words) {
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word.value)) continue;
		return path.basename(word.value).toLowerCase();
	}
	return "";
}

function argumentsAfterCommand(words) {
	const index = words.findIndex(
		(word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word.value),
	);
	return index === -1 ? [] : words.slice(index + 1);
}

/** Non-flag arguments, as repo-relative paths, dropping anything outside. */
function repoTargets(args, { skipFirstNonFlag = false } = {}) {
	const targets = [];
	let skipped = !skipFirstNonFlag;
	for (const arg of args) {
		const value = arg.value;
		if (value.startsWith("-")) continue;
		if (!skipped) {
			skipped = true;
			continue;
		}
		const candidate = value.startsWith("of=") ? value.slice(3) : value;
		const relative = toRepoRelative(candidate);
		if (relative !== null) targets.push(relative);
	}
	return targets;
}

function hasInPlaceFlag(args) {
	return args.some((arg) => /^-{1,2}i/.test(arg.value));
}

/**
 * Reads a shell command for repository writes.
 *
 * Returns `{ discard, targets }`: `discard` names a git command that would
 * destroy uncommitted work, and `targets` lists repo paths the command would
 * change. Anything that writes only outside the repository comes back empty,
 * because the author's review is about this repository's content.
 */
function analyseCommand(command) {
	const segments = splitSegments(tokenize(command));
	const targets = new Set();
	let discard = null;

	for (const segment of segments) {
		for (const redirect of segment.redirects) {
			const relative = toRepoRelative(redirect);
			if (relative !== null) targets.add(relative);
		}

		const word = commandWord(segment.words);
		if (!word) continue;
		const args = argumentsAfterCommand(segment.words);

		if (word === "git") {
			const sub = args.find((arg) => !arg.value.startsWith("-"))?.value ?? "";
			if (GIT_DISCARD.has(sub)) {
				discard = `git ${sub}`;
			} else if (GIT_WRITE.has(sub)) {
				targets.add(`the repository (git ${sub})`);
			}
			continue;
		}

		if (WRITE_COMMANDS.has(word)) {
			const found = repoTargets(args);
			if (found.length > 0) for (const target of found) targets.add(target);
			// A writing command with no argument inside the repo is either aimed
			// elsewhere or aimed at nothing; both are fine to let through.
			continue;
		}

		if (IN_PLACE_COMMANDS.has(word) && hasInPlaceFlag(args)) {
			for (const target of repoTargets(args, { skipFirstNonFlag: true })) {
				targets.add(target);
			}
		}
	}

	return { discard, targets: [...targets] };
}

function deny(agent, reason, short) {
	if (agent === "claude") {
		process.stdout.write(
			`${JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					permissionDecisionReason: reason,
				},
			})}\n`,
		);
	} else {
		process.stdout.write(
			`${JSON.stringify({
				permission: "deny",
				user_message: short,
				agent_message: reason,
			})}\n`,
		);
	}
}

const PHRASE_LINE =
	'To edit, the user must send, verbatim: "For the love of everything, please edit, please help me".';
const NO_ROUTING_LINE =
	"Do not ask the user to disable this hook, and do not route the write through a shell command or an interpreter.";

function denyUnapproved(agent, targets, kind) {
	const target = targets.join(", ");
	deny(
		agent,
		`Write gate: ${kind} would change ${target}, and no approval is active. This repository defaults to analysis: report what you found and stop, so the author can decide. ${PHRASE_LINE} ${NO_ROUTING_LINE}`,
		`Write gate: blocked a change to ${target}. Send the approval phrase if you want it.`,
	);
}

function denyNoteSkillClosed(agent, targets) {
	const target = targets.join(", ");
	deny(
		agent,
		`Write gate: ${target} is inside docs/knowledge/, which only the ${NOTE_SKILL} skill may write unapproved, and that skill is not open in this session. Invoke the ${NOTE_SKILL} skill first (or run \`npm run gate:note\` in a harness without skills). ${PHRASE_LINE}`,
		`Write gate blocked a note write — the ${NOTE_SKILL} skill is not open.`,
	);
}

function denyGitDiscard(agent, discard) {
	deny(
		agent,
		`Write gate: refusing \`${discard}\`. CLAUDE.md forbids git checkout, restore, reset, clean and stash for discarding working-tree changes, because uncommitted work in this repo may be the author's. Approval does not unlock this. If the author explicitly asked for it, have them run it themselves.`,
		`Write gate blocked \`${discard}\` — it discards uncommitted work.`,
	);
}

function runPromptMode(agent, payload) {
	const prompt = payload.prompt ?? payload.user_prompt ?? payload.message ?? "";
	if (normalise(prompt).includes(PHRASE)) {
		writeMarker(agent, "approved", { promptLength: String(prompt).length });
		if (agent === "claude") {
			process.stdout.write(
				`${JSON.stringify({
					hookSpecificOutput: {
						hookEventName: "UserPromptSubmit",
						additionalContext:
							"Write gate: the approval phrase is present, so edits are unblocked for this turn only. " +
							"Approval covers only the change the user just described — not the next file, the next finding, or the next turn. " +
							"Re-read every file immediately before writing to it, and leave the result uncommitted.",
					},
				})}\n`,
			);
		}
		return 0;
	}
	// No phrase in this message: the previous turn's approval ends here.
	clearMarker(agent, "approved");
	return 0;
}

/** The Skill tool opening `knowledge-note` is what earns the exception. */
function noteSkillOpening(toolName, toolInput) {
	if (!SKILL_TOOL.test(String(toolName))) return false;
	const named = toolInput?.skill ?? toolInput?.name ?? toolInput?.skill_name;
	return normalise(named) === NOTE_SKILL;
}

function runShellCall(agent, command, approved) {
	if (!command) return 0;
	const { discard, targets } = analyseCommand(command);
	if (discard) {
		denyGitDiscard(agent, discard);
		return 0;
	}
	if (approved || targets.length === 0) return 0;
	denyUnapproved(agent, targets, "this shell command");
	return 0;
}

function runFileCall(agent, toolInput, approved) {
	const raw = [];
	collectPaths(toolInput, false, raw);
	const targets = raw.map(toRepoRelative).filter((value) => value !== null);
	if (targets.length === 0) return 0;

	const outside = targets.filter((target) => !isSkillWritable(target));
	if (outside.length > 0) {
		if (!approved) denyUnapproved(agent, outside, "this edit");
		return 0;
	}

	// Every target is inside docs/knowledge/. The exception belongs to the note
	// skill, so approval or an open skill unlocks it — nothing else does.
	if (!approved && !readMarker(agent, "skill")) {
		denyNoteSkillClosed(agent, targets);
	}
	return 0;
}

function runToolMode(agent, payload) {
	const toolName = payload.tool_name ?? payload.toolName ?? "";
	const toolInput = payload.tool_input ?? payload.toolInput ?? {};
	const approved = readMarker(agent, "approved");

	if (noteSkillOpening(toolName, toolInput)) {
		writeMarker(agent, "skill", { skill: NOTE_SKILL });
		return 0;
	}

	if (
		SHELL_TOOL.test(String(toolName)) ||
		typeof payload.command === "string"
	) {
		const command = String(toolInput.command ?? payload.command ?? "");
		return runShellCall(agent, command, approved);
	}

	if (!EDIT_TOOL.test(String(toolName))) return 0;
	return runFileCall(agent, toolInput, approved);
}

function main(argv) {
	const [agent, mode] = argv;
	const agents = ["claude", "cursor"];
	const modes = ["prompt", "tool", "session", "open"];
	if (!agents.includes(agent) || !modes.includes(mode)) {
		process.stderr.write(
			"usage: gate.mjs <claude|cursor> <prompt|tool|session|open>\n",
		);
		return 0; // Fail open on our own misconfiguration; never wedge the agent.
	}
	if (mode === "session") {
		clearMarker(agent, "skill");
		return 0;
	}
	if (mode === "open") {
		writeMarker(agent, "skill", {
			skill: NOTE_SKILL,
			via: "npm run gate:note",
		});
		process.stderr.write(
			`write-gate: ${NOTE_SKILL} is open for ${agent}; docs/knowledge/ is writable until this session ends\n`,
		);
		return 0;
	}
	const payload = parsePayload();
	return mode === "prompt"
		? runPromptMode(agent, payload)
		: runToolMode(agent, payload);
}

process.exitCode = main(process.argv.slice(2));
