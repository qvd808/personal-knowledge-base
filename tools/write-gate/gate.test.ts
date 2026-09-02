import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "gate.mjs");
const REPO_ROOT = path.resolve(HERE, "..", "..");
const MARKER_DIR = path.join(REPO_ROOT, ".git", "write-gate");

/** The agent name the tests use, so real markers are never disturbed. */
const AGENT = "cursor";

interface Decision {
	permission?: string;
	agent_message?: string;
	hookSpecificOutput?: {
		permissionDecision?: string;
		permissionDecisionReason?: string;
	};
}

function run(mode: string, payload: unknown): Decision | null {
	const result = spawnSync(process.execPath, [GATE, AGENT, mode], {
		input: JSON.stringify(payload),
		encoding: "utf8",
	});
	assert.equal(
		result.status,
		0,
		`gate exited ${result.status}: ${result.stderr}`,
	);
	const out = result.stdout.trim();
	return out ? (JSON.parse(out) as Decision) : null;
}

function denied(decision: Decision | null): boolean {
	return decision?.permission === "deny";
}

function markerFile(kind: string): string {
	return path.join(MARKER_DIR, `${kind}-${AGENT}.json`);
}

function clearMarkers(): void {
	for (const kind of ["approved", "skill"]) {
		fs.rmSync(markerFile(kind), { force: true });
	}
}

const APPROVAL =
	"For the love of everything, please edit, please help me, fix the parser";

describe("write gate", () => {
	beforeEach(clearMarkers);
	afterEach(clearMarkers);

	describe("approval marker", () => {
		it("is written when the user's message carries the phrase", () => {
			run("prompt", { prompt: APPROVAL });
			assert.ok(fs.existsSync(markerFile("approved")));
		});

		it("ignores case and collapsed whitespace", () => {
			run("prompt", {
				prompt: "FOR THE LOVE  OF EVERYTHING,\nplease edit, please help me",
			});
			assert.ok(fs.existsSync(markerFile("approved")));
		});

		it("is removed by the next message that lacks the phrase", () => {
			run("prompt", { prompt: APPROVAL });
			run("prompt", { prompt: "now also fix the other file" });
			assert.ok(!fs.existsSync(markerFile("approved")));
		});

		it("is not written by a message that only talks about the phrase", () => {
			run("prompt", { prompt: "what happens if I say the approval sentence?" });
			assert.ok(!fs.existsSync(markerFile("approved")));
		});
	});

	describe("file edits", () => {
		const edit = { tool_name: "Write", tool_input: { file_path: "src/x.ts" } };

		it("are denied outside docs/knowledge without approval", () => {
			assert.ok(denied(run("tool", edit)));
		});

		it("are allowed outside docs/knowledge with approval", () => {
			run("prompt", { prompt: APPROVAL });
			assert.equal(run("tool", edit), null);
		});

		it("are denied for an absolute path outside docs/knowledge", () => {
			const absolute = path.join(REPO_ROOT, "src", "x.ts");
			assert.ok(
				denied(
					run("tool", {
						tool_name: "Write",
						tool_input: { file_path: absolute },
					}),
				),
			);
		});

		it("are denied when any one target of several is outside", () => {
			const decision = run("tool", {
				tool_name: "Edit",
				tool_input: { paths: ["docs/knowledge/01-x.md", "src/x.ts"] },
			});
			assert.ok(denied(decision));
			assert.match(String(decision?.agent_message), /src\/x\.ts/);
		});

		it("leave non-editing tools alone", () => {
			assert.equal(
				run("tool", {
					tool_name: "Read",
					tool_input: { file_path: "src/x.ts" },
				}),
				null,
			);
		});
	});

	describe("the docs/knowledge exception", () => {
		const note = {
			tool_name: "Write",
			tool_input: { file_path: "docs/knowledge/01-x.md" },
		};

		it("is closed until the note skill is open", () => {
			const decision = run("tool", note);
			assert.ok(denied(decision));
			assert.match(String(decision?.agent_message), /knowledge-note/);
		});

		it("opens when the Skill tool invokes knowledge-note", () => {
			run("tool", {
				tool_name: "Skill",
				tool_input: { skill: "knowledge-note" },
			});
			assert.ok(fs.existsSync(markerFile("skill")));
			assert.equal(run("tool", note), null);
		});

		it("does not open for a different skill", () => {
			run("tool", { tool_name: "Skill", tool_input: { skill: "research" } });
			assert.ok(!fs.existsSync(markerFile("skill")));
			assert.ok(denied(run("tool", note)));
		});

		it("does not extend past docs/knowledge", () => {
			run("tool", {
				tool_name: "Skill",
				tool_input: { skill: "knowledge-note" },
			});
			assert.ok(
				denied(
					run("tool", {
						tool_name: "Write",
						tool_input: { file_path: "src/x.ts" },
					}),
				),
			);
		});

		it("is cleared at session start", () => {
			run("tool", {
				tool_name: "Skill",
				tool_input: { skill: "knowledge-note" },
			});
			spawnSync(process.execPath, [GATE, AGENT, "session"], {
				encoding: "utf8",
			});
			assert.ok(!fs.existsSync(markerFile("skill")));
		});
	});

	describe("shell commands", () => {
		function shell(command: string) {
			return run("tool", { tool_name: "Bash", tool_input: { command } });
		}

		it("are allowed when they only read", () => {
			assert.equal(shell("grep -rn TODO src/"), null);
			assert.equal(shell("npm run glue -- --check"), null);
			assert.equal(shell("cat package.json | head -20"), null);
		});

		it("are denied when they change repository content", () => {
			assert.ok(denied(shell("echo hi > notes.txt")));
			assert.ok(denied(shell("sed -i 's/a/b/' src/x.ts")));
			assert.ok(denied(shell("rm -rf build")));
			assert.ok(denied(shell("cp a.txt b.txt")));
			assert.ok(denied(shell("mkdir src/new")));
		});

		it("are allowed to write once approval is active", () => {
			run("prompt", { prompt: APPROVAL });
			assert.equal(shell("echo hi > notes.txt"), null);
		});

		it("leave the issue tracker and other tooling alone", () => {
			// Wayfinder drives GitHub issues through `gh`; none of this touches
			// repository content, so none of it is the author's review to give.
			assert.equal(shell("gh issue create --title T --body B"), null);
			assert.equal(shell("gh issue comment 12 --body ok"), null);
			assert.equal(shell("gh pr view 3 --json state"), null);
			assert.equal(shell("git status --short"), null);
			assert.equal(shell("git log --oneline -5"), null);
			assert.equal(shell("git diff --stat"), null);
		});

		it("leave dependency installs and app runs alone", () => {
			assert.equal(shell("npm install"), null);
			assert.equal(shell("npm i -D biome"), null);
			assert.equal(shell("pip install requests"), null);
			assert.equal(shell("npm test"), null);
			assert.equal(shell("npm run dev"), null);
			assert.equal(shell("node server.js"), null);
			assert.equal(shell("python -m pytest -q"), null);
		});

		it("leave writes outside the repository alone", () => {
			const outside = path.join(path.parse(REPO_ROOT).root, "tmp", "scratch");
			assert.equal(shell(`mkdir -p ${outside}`), null);
			assert.equal(shell(`rm -rf ${outside}`), null);
			assert.equal(shell(`npm test > ${outside}/out.txt`), null);
			assert.equal(shell("npm test 2>/dev/null"), null);
		});

		it("read a write verb inside a quoted string as text", () => {
			// The old rule matched these and denied its own read-only commands.
			assert.equal(shell('grep -rn "mkdir" tools/'), null);
			assert.equal(
				shell("gh issue comment 4 --body 'we should rm that'"),
				null,
			);
			assert.equal(shell('echo "npm install is fine"'), null);
		});

		it("still catch a write hidden later in a pipeline", () => {
			assert.ok(denied(shell("cat package.json | tee copy.json")));
			assert.ok(denied(shell("gh issue view 3 > docs/agents/issue.md")));
		});

		it("gate git add and commit, which the author does personally", () => {
			assert.ok(denied(shell("git add -A")));
			assert.ok(denied(shell("git commit -m 'wip'")));
			assert.ok(denied(shell("git push origin main")));
		});

		it("refuse to discard working-tree changes even when approved", () => {
			run("prompt", { prompt: APPROVAL });
			for (const subcommand of [
				"checkout -- .",
				"restore src",
				"reset --hard",
				"clean -fd",
				"stash",
			]) {
				const decision = shell(`git ${subcommand}`);
				assert.ok(denied(decision), `git ${subcommand} should be denied`);
				assert.match(String(decision?.agent_message), /uncommitted work/);
			}
		});
	});

	describe("malformed input", () => {
		it("fails open rather than wedging the agent", () => {
			const result = spawnSync(process.execPath, [GATE, AGENT, "tool"], {
				input: "not json",
				encoding: "utf8",
			});
			assert.equal(result.status, 0);
			assert.equal(result.stdout.trim(), "");
		});
	});
});
