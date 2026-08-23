import assert from "node:assert/strict";
import { test } from "node:test";
import {
	commitMessage,
	isOfflineShaped,
	parsePromptAnswer,
} from "../machine.ts";
import { messageBoxArgs, parseTasklist, psQuote } from "../shell.ts";

test("parseTasklist detects a running image from CSV output", () => {
	const stdout =
		'"Obsidian.exe","1234","Console","1","100,000 K"\r\n' +
		'"Obsidian.exe","5678","Console","1","90,000 K"\r\n';

	assert.equal(parseTasklist(stdout, "Obsidian.exe"), true);
});

test("parseTasklist returns false on the INFO no-match line", () => {
	const stdout =
		"INFO: No tasks are running which match the specified criteria.\r\n";

	assert.equal(parseTasklist(stdout, "Obsidian.exe"), false);
});

test("parseTasklist matches case-insensitively", () => {
	const stdout = '"obsidian.EXE","1234","Console","1","100,000 K"\r\n';

	assert.equal(parseTasklist(stdout, "Obsidian.exe"), true);
});

test("parsePromptAnswer parses Yes/No with CRLF and whitespace", () => {
	assert.equal(parsePromptAnswer("Yes\r\n"), "yes");
	assert.equal(parsePromptAnswer("No\n"), "no");
	assert.equal(parsePromptAnswer("  yes  "), "yes");
});

test("parsePromptAnswer returns null for anything else", () => {
	assert.equal(parsePromptAnswer(""), null);
	assert.equal(parsePromptAnswer("garbage\r\n"), null);
});

const OFFLINE_OUTPUTS = [
	"fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host github.com",
	"ssh: connect to host github.com port 22: Connection timed out",
	"fatal: unable to connect to github.com: Temporary failure in name resolution",
	"fatal: unable to connect to github.com: Network is unreachable",
	"error: RPC failed; curl 7 Failed to connect to github.com port 443",
	"fatal: unable to connect to github.com: No route to host",
];

test("isOfflineShaped matches connection-shaped failures", () => {
	for (const output of OFFLINE_OUTPUTS) {
		assert.equal(isOfflineShaped(output), true, output);
	}
});

const REAL_FAILURE_OUTPUTS = [
	"fatal: Authentication failed for 'https://github.com/x/y.git/'",
	" ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs",
	"Permission denied (publickey).\r\nfatal: Could not read from remote repository.",
	"remote: Permission to x/y.git denied to user.\nfatal: unable to access 'https://github.com/x/y.git/': The requested URL returned error: 403",
];

test("isOfflineShaped does not match auth or rejected failures", () => {
	for (const output of REAL_FAILURE_OUTPUTS) {
		assert.equal(isOfflineShaped(output), false, output);
	}
});

test("commitMessage is singular for one file, plural otherwise", () => {
	assert.equal(
		commitMessage("2026-08-23", 1),
		"sync(2026-08-23): 1 file changed",
	);
	assert.equal(
		commitMessage("2026-08-23", 3),
		"sync(2026-08-23): 3 files changed",
	);
});

test("psQuote doubles single quotes and flattens newlines", () => {
	assert.equal(psQuote("it's\nbroken"), "it''s broken");
});

test("messageBoxArgs builds a NoProfile STA WinForms command", () => {
	const args = messageBoxArgs(
		"Sync notes to GitHub?",
		"Obsidian sync",
		"YesNo",
		"Question",
	);

	assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-Sta", "-Command"]);
	const command = args[3] ?? "";
	assert.match(command, /Add-Type -AssemblyName System\.Windows\.Forms/);
	assert.match(command, /MessageBox\]::Show\('Sync notes to GitHub\?'/);
	assert.match(command, /'YesNo', 'Question'\)/);
	assert.match(command, /\.ToString\(\)$/);
});
