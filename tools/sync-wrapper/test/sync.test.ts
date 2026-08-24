import assert from "node:assert/strict";
import { test } from "node:test";
import {
	baseHandler,
	cleanup,
	exists,
	FakeShell,
	fail,
	makeTmpRoot,
	NO_TASKS,
	notifications,
	ok,
	runFake,
	tasksRunning,
	timeline,
	writeFile,
} from "./helpers.ts";

test("happy path: exit hint → verify → steps → prompt → git sequence", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler();

	const state = await runFake(fake, root);

	assert.deepEqual(fake.launches, [
		{
			command: "C:\\fake\\Obsidian.exe",
			args: ["obsidian://open?vault=knowledge"],
		},
	]);
	assert.deepEqual(timeline(fake), [
		"tasklist:Obsidian.exe",
		"step:glue",
		"git:status --porcelain -- .claude/skills/ AGENTS.md",
		"step:fill",
		"step:lint",
		"step:index",
		"prompt",
		"git:add -A",
		"git:diff --cached --name-only",
		"git:commit -m sync(2026-08-23): 2 files changed",
		"git:pull --rebase",
		"git:push",
	]);
	assert.equal(state.haltCode, 0);
	assert.equal(state.haltMessage, "Sync complete.");
	assert.deepEqual(notifications(fake), []);
});

test("git runs non-interactively from the repo root", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler();

	await runFake(fake, root);

	const gitRuns = fake.runs.filter((run) => run.command === "git");
	assert.ok(gitRuns.length > 0);
	for (const run of gitRuns) {
		assert.equal(run.cwd, root);
		assert.equal(run.env?.GIT_TERMINAL_PROMPT, "0");
		assert.equal(run.env?.GIT_EDITOR, "true");
		assert.equal(run.env?.GIT_SEQUENCE_EDITOR, "true");
		assert.equal(run.env?.GCM_INTERACTIVE, "0");
	}
});

test("single-instance handoff: exit hint is verified before prompting", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	// The spawned process exits immediately (handoff), Obsidian stays alive.
	const obsidianChecks = [
		tasksRunning("Obsidian.exe"),
		tasksRunning("Obsidian.exe"),
		NO_TASKS,
	];
	fake.handler = baseHandler((command, args) => {
		if (command === "tasklist" && args.join(" ").includes("Obsidian.exe")) {
			return ok({ stdout: obsidianChecks.shift() ?? NO_TASKS });
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	const line = timeline(fake);
	assert.deepEqual(line.slice(0, 3), [
		"tasklist:Obsidian.exe",
		"tasklist:Obsidian.exe",
		"tasklist:Obsidian.exe",
	]);
	assert.deepEqual(fake.sleeps, [1000, 1000]);
	assert.ok(line.indexOf("prompt") > 2);
	assert.equal(state.haltCode, 0);
	assert.equal(state.haltMessage, "Sync complete.");
});

test("decline path: No commits nothing and exits cleanly", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command) => {
		if (command === "powershell.exe") return ok({ stdout: "No\r\n" });
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.equal(timeline(fake).at(-1), "prompt");
	assert.ok(!timeline(fake).some((tag) => tag.startsWith("git:add")));
	assert.equal(state.haltCode, 0);
	assert.match(state.haltMessage ?? "", /Nothing committed/);
	assert.deepEqual(notifications(fake), []);
});

test("an unparsable prompt answer is treated as a decline", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command) => {
		if (command === "powershell.exe") return ok({ stdout: "garbage\r\n" });
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.ok(!timeline(fake).some((tag) => tag.startsWith("git:add")));
	assert.equal(state.haltCode, 0);
	assert.match(state.haltMessage ?? "", /Nothing committed/);
});

test("offline push: commit stays local, benign warning, clean exit", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "git" && args[0] === "push") {
			return fail(
				128,
				"fatal: unable to access " +
					"'https://github.com/qvd808/personal-knowledge-base.git/': " +
					"Could not resolve host github.com",
			);
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	const line = timeline(fake);
	assert.deepEqual(line.slice(-2), ["git:push", "notify"]);
	assert.ok(line.includes("git:commit -m sync(2026-08-23): 2 files changed"));
	assert.equal(state.haltCode, 0);
	assert.equal(notifications(fake).length, 1);
	assert.match(notifications(fake)[0] ?? "", /stayed local/);
	assert.match(notifications(fake)[0] ?? "", /'Warning'/);
});

test("real push failure (rejected): error wording, still a clean exit", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "git" && args[0] === "push") {
			return fail(
				1,
				"To https://github.com/qvd808/personal-knowledge-base.git\n" +
					" ! [rejected]        main -> main (fetch first)\n" +
					"error: failed to push some refs",
			);
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.equal(state.haltCode, 0);
	assert.equal(notifications(fake).length, 1);
	assert.match(notifications(fake)[0] ?? "", /safe locally/);
	assert.match(notifications(fake)[0] ?? "", /'Error'/);
});

test("stale index.lock with no git.exe is removed before syncing", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".git/index.lock", "");
	const fake = new FakeShell();
	fake.handler = baseHandler();

	const state = await runFake(fake, root);

	assert.equal(exists(root, ".git/index.lock"), false);
	const line = timeline(fake);
	assert.deepEqual(line.slice(0, 3), [
		"tasklist:Obsidian.exe",
		"tasklist:git.exe",
		"step:glue",
	]);
	assert.equal(state.haltCode, 0);
});

test("index.lock is waited out while a git.exe is alive", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".git/index.lock", "");
	const fake = new FakeShell();
	const gitChecks = [
		tasksRunning("git.exe"),
		tasksRunning("git.exe"),
		NO_TASKS,
	];
	fake.handler = baseHandler((command, args) => {
		if (command === "tasklist" && args.join(" ").includes("git.exe")) {
			return ok({ stdout: gitChecks.shift() ?? NO_TASKS });
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	const line = timeline(fake);
	assert.deepEqual(line.slice(0, 4), [
		"tasklist:Obsidian.exe",
		"tasklist:git.exe",
		"tasklist:git.exe",
		"tasklist:git.exe",
	]);
	assert.deepEqual(fake.sleeps, [1000, 1000]);
	assert.equal(exists(root, ".git/index.lock"), false);
	assert.equal(state.haltCode, 0);
});

test("a git.exe that never exits times out into a notification", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, ".git/index.lock", "");
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "tasklist" && args.join(" ").includes("git.exe")) {
			return ok({ stdout: tasksRunning("git.exe") });
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.ok(!timeline(fake).some((tag) => tag.startsWith("step:")));
	assert.equal(state.haltCode, 1);
	assert.equal(notifications(fake).length, 1);
	assert.match(notifications(fake)[0] ?? "", /still running/);
	// The lock is left alone while git.exe lives.
	assert.equal(exists(root, ".git/index.lock"), true);
});

const IN_PROGRESS_MARKERS: Record<string, string> = {
	merge: ".git/MERGE_HEAD",
	"rebase (rebase-merge/)": ".git/rebase-merge/msgnum",
	"rebase (rebase-apply/)": ".git/rebase-apply/apply",
};

for (const [name, marker] of Object.entries(IN_PROGRESS_MARKERS)) {
	test(`pre-flight refuses with a ${name} in progress`, async (t) => {
		const root = makeTmpRoot();
		t.after(() => cleanup(root));
		writeFile(root, marker, "abc123\n");
		const fake = new FakeShell();
		fake.handler = baseHandler();

		const state = await runFake(fake, root);

		assert.deepEqual(timeline(fake), ["tasklist:Obsidian.exe", "notify"]);
		assert.equal(state.haltCode, 1);
		assert.match(notifications(fake)[0] ?? "", /merge or rebase/i);
	});
}

test("a glue diff after regeneration aborts before lint", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "git" && args[0] === "status") {
			return ok({ stdout: " M .claude/skills/caveman/SKILL.md\n" });
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.deepEqual(timeline(fake), [
		"tasklist:Obsidian.exe",
		"step:glue",
		"git:status --porcelain -- .claude/skills/ AGENTS.md",
		"notify",
	]);
	assert.equal(state.haltCode, 1);
	assert.match(notifications(fake)[0] ?? "", /out of sync/);
});

test("a failing glue step aborts before the diff check", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((_command, args) => {
		if (args[2] === "tools/skill-glue/generate.ts") {
			return fail(1, "skill-glue: no skills in store");
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.deepEqual(timeline(fake), [
		"tasklist:Obsidian.exe",
		"step:glue",
		"notify",
	]);
	assert.equal(state.haltCode, 1);
	assert.match(notifications(fake)[0] ?? "", /Skill glue failed/);
});

test("a failing vault lint aborts before the index step", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((_command, args) => {
		if (args[2] === "tools/vault-lint/lint.ts") {
			return fail(1, "vault-lint: 2 violation(s)");
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	const line = timeline(fake);
	assert.deepEqual(line, [
		"tasklist:Obsidian.exe",
		"step:glue",
		"git:status --porcelain -- .claude/skills/ AGENTS.md",
		"step:fill",
		"step:lint",
		"notify",
	]);
	assert.equal(state.haltCode, 1);
	assert.match(notifications(fake)[0] ?? "", /Vault lint failed/);
});

test("a failing index step aborts before the prompt", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((_command, args) => {
		if (args[2] === "tools/index-generator/generate.ts") {
			return fail(1, "index: knowledge/index.md not found");
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	assert.ok(!timeline(fake).includes("prompt"));
	assert.equal(timeline(fake).at(-1), "notify");
	assert.equal(state.haltCode, 1);
	assert.match(notifications(fake)[0] ?? "", /Index generator failed/);
});

test("a rebase stop notifies and never auto-continues", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "git" && args[0] === "pull") {
			// git leaves rebase state behind when it stops on a conflict.
			writeFile(root, ".git/rebase-merge/msgnum", "1\n");
			return fail(
				1,
				"CONFLICT (content): Merge conflict in knowledge/a.md\n" +
					"error: could not apply abc1234... sync",
			);
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	const line = timeline(fake);
	assert.ok(line.includes("git:pull --rebase"));
	assert.ok(!line.includes("git:push"));
	assert.ok(!fake.runs.some((run) => run.args.includes("--continue")));
	assert.equal(line.at(-1), "notify");
	assert.equal(state.haltCode, 1);
	assert.match(notifications(fake)[0] ?? "", /Rebase stopped/);
});

test("an offline pull is benign: commit stays local, clean exit", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "git" && args[0] === "pull") {
			return fail(
				128,
				"ssh: connect to host github.com port 22: Connection timed out\r\n" +
					"fatal: Could not read from remote repository.",
			);
		}
		return undefined;
	});

	const state = await runFake(fake, root);

	const line = timeline(fake);
	assert.deepEqual(line.slice(-2), ["git:pull --rebase", "notify"]);
	assert.ok(!line.includes("git:push"));
	assert.equal(state.haltCode, 0);
	assert.match(notifications(fake)[0] ?? "", /stayed local/);
	assert.match(notifications(fake)[0] ?? "", /'Warning'/);
});

test("a clean tree skips the commit but still pulls and pushes", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.handler = baseHandler((command, args) => {
		if (command === "git" && args[0] === "diff") return ok({ stdout: "" });
		return undefined;
	});

	const state = await runFake(fake, root);

	const gitRuns = timeline(fake).filter((tag) => tag.startsWith("git:"));
	assert.deepEqual(gitRuns, [
		"git:status --porcelain -- .claude/skills/ AGENTS.md",
		"git:add -A",
		"git:diff --cached --name-only",
		"git:pull --rebase",
		"git:push",
	]);
	assert.equal(state.haltCode, 0);
});

test("a launch failure notifies instead of prompting", async (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const fake = new FakeShell();
	fake.exitInfo = {
		code: null,
		signal: null,
		error: "spawn C:\\fake\\Obsidian.exe ENOENT",
	};
	fake.handler = baseHandler();

	const state = await runFake(fake, root);

	assert.deepEqual(timeline(fake), ["notify"]);
	assert.equal(state.haltCode, 1);
	// psQuote doubles the apostrophe in "Couldn't".
	assert.match(notifications(fake)[0] ?? "", /Couldn''t launch Obsidian/);
});
