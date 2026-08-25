import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../harvest.ts";
import { resourceId } from "../ids.ts";
import { BEGIN_MARKER, END_MARKER } from "../render.ts";
import {
	cleanup,
	makeTmpRoot,
	noteMd,
	readFile,
	registryLine,
	resourcesMd,
	writeFile,
} from "./helpers.ts";

const FIFO =
	"http://www.sunburst-design.com/papers/CummingsSNUG2002SJ_FIFO1.pdf";
const BLOG =
	"https://colinoflynn.com/2020/12/experimenting-with-metastability-and-multiple-clocks-on-fpgas/";

function id(url: string): string {
	return resourceId(url);
}

test("rewrites inline links, renders the registry, and is byte-idempotent", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"fpga.md",
		noteMd({ tags: ["fpga"], resources: [`- [FIFO paper](${FIFO})`] }),
	);

	const first = run(root);
	assert.equal(first.ok, true);
	assert.equal(first.changed, true);
	assert.equal(first.resources, 1);
	assert.equal(
		readFile(root, "fpga.md"),
		noteMd({
			tags: ["fpga"],
			resources: [`- [[resources#^${id(FIFO)}|FIFO paper]]`],
		}),
	);
	const expectedResources = [
		"",
		"",
		BEGIN_MARKER,
		"",
		"## fpga",
		"",
		"- [FIFO paper](http://www.sunburst-design.com/papers/CummingsSNUG2002SJ_FIFO1.pdf)",
		"",
		"## References",
		"",
		registryLine(FIFO),
		"",
		END_MARKER,
		"",
	].join("\n");
	assert.equal(readFile(root, "resources.md"), expectedResources);

	const second = run(root);
	assert.equal(second.ok, true);
	assert.equal(second.changed, false);
});

test("rewrites reference usages and deletes consumed definitions", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"fpga.md",
		noteMd({
			tags: ["fpga"],
			resources: ["- see [the paper][fifo]", "", `[fifo]: <${FIFO}>`],
		}),
	);

	const result = run(root);
	assert.equal(result.ok, true);
	const body = readFile(root, "fpga.md");
	assert.ok(body.includes(`- see [[resources#^${id(FIFO)}|the paper]]`));
	assert.ok(!body.includes("[fifo]:"));
	assert.deepEqual(result.resources === 1, true);
});

test("an orphan definition passes through untouched — never an error", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"fpga.md",
		noteMd({
			tags: ["fpga"],
			resources: ["- no usages here", "", `[orphan]: <${BLOG}>`],
		}),
	);

	const result = run(root);
	assert.equal(result.ok, true);
	assert.equal(result.resources, 0);
	assert.ok(readFile(root, "fpga.md").includes(`[orphan]: <${BLOG}>`));
});

test("the same URL across notes merges onto one registry line; first note wins the title", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"zeta.md",
		noteMd({
			tags: ["z-tag"],
			created: "2026-01-02",
			resources: [`- [Zeta title](${BLOG})`],
		}),
	);
	writeFile(
		root,
		"alpha.md",
		noteMd({ tags: ["a-tag"], resources: [`- [Alpha title](${BLOG})`] }),
	);

	const result = run(root);
	assert.equal(result.ok, true);
	assert.equal(result.resources, 1);
	const generated = readFile(root, "resources.md");
	assert.ok(generated.includes(`- [Alpha title](${BLOG})`));
	assert.ok(!generated.includes("Zeta title"));
	for (const tag of ["## a-tag", "## z-tag"]) {
		assert.ok(generated.includes(tag));
	}
});

test("a sustained wikilink keeps its registry line after the raw URL is gone", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"fpga.md",
		noteMd({
			tags: ["fpga"],
			resources: [`- [[resources#^${id(FIFO)}|FIFO paper]]`],
		}),
	);
	writeFile(
		root,
		"resources.md",
		resourcesMd(["## References", "", registryLine(FIFO)]),
	);

	const first = run(root);
	assert.equal(first.ok, true);
	assert.equal(first.resources, 1);

	const second = run(root);
	assert.equal(second.ok, true);
	assert.equal(second.changed, false);
	assert.ok(readFile(root, "resources.md").includes(registryLine(FIFO)));
});

test("a registry line nobody sustains drops on the next run", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "fpga.md", noteMd({ tags: ["fpga"] }));
	writeFile(
		root,
		"resources.md",
		resourcesMd(["## References", "", registryLine(FIFO), registryLine(BLOG)]),
	);

	const result = run(root);
	assert.equal(result.ok, true);
	assert.equal(result.changed, true);
	assert.equal(result.resources, 0);
	assert.ok(!readFile(root, "resources.md").includes("^res-"));
});

test("a sustained id missing from the registry loud-fails", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(
		root,
		"fpga.md",
		noteMd({
			tags: ["fpga"],
			resources: [`- [[resources#^${id(FIFO)}|FIFO]]`],
		}),
	);

	const result = run(root);
	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /absent from the resources\.md registry/);
});

test("unbalanced generated markers loud-fail instead of clobbering", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "fpga.md", noteMd({ tags: ["fpga"] }));
	writeFile(root, "resources.md", `${BEGIN_MARKER}\nnever closed\n`);

	const result = run(root);
	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /unbalanced generated-section markers/);
});

test("mutations stay inside Resources sections; headings close and reopen them", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const body = [
		"# FPGA note",
		"",
		`Prose link [not a resource](${BLOG}) stays put.`,
		"",
		"## Resources",
		"",
		`- [Metastability](${BLOG})`,
		"",
		"### Reading order",
		"",
		`- also [the blog](${BLOG})`,
		"",
		"## Notes",
		"",
		`- [still not a resource](${BLOG})`,
		"",
	].join("\n");
	writeFile(root, "fpga.md", `${body}---\n`);

	const result = run(root);
	assert.equal(result.ok, true);
	const after = readFile(root, "fpga.md");
	assert.ok(after.includes(`Prose link [not a resource](${BLOG}) stays put.`));
	assert.ok(after.includes(`- [still not a resource](${BLOG})`));
	assert.ok(after.includes("### Reading order"));
	assert.equal(after.split(`[[resources#^${id(BLOG)}`).length - 1, 2);
});

test("index.md and resources.md never feed the membership scan", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	writeFile(root, "fpga.md", noteMd({ tags: ["fpga"] }));
	writeFile(
		root,
		"index.md",
		noteMd({ tags: ["index"], resources: [`- [sneaky](${BLOG})`] }),
	);

	const result = run(root);
	assert.equal(result.ok, true);
	assert.equal(result.resources, 0);
});

test("CRLF note bodies keep their line endings through a rewrite", (t) => {
	const root = makeTmpRoot();
	t.after(() => cleanup(root));
	const lf = noteMd({ tags: ["fpga"], resources: [`- [FIFO](${FIFO})`] });
	writeFile(root, "fpga.md", lf.replace(/\n/g, "\r\n"));

	const result = run(root);
	assert.equal(result.ok, true);
	assert.ok(readFile(root, "fpga.md").includes("\r\n"));
});
