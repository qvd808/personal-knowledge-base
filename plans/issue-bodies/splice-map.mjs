// One-shot helper for #39 resolution: appends the t4 decision line to the
// map body's "Decisions so far" list (before "## Not yet specified").
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const raw = execFileSync(
	"gh",
	["api", "repos/qvd808/personal-knowledge-base/issues/35", "--jq", ".body"],
	{ encoding: "utf8" },
);
const body = raw.replace(/\r\n/g, "\n").replace(/\n+$/, "");
const line = readFileSync("plans/issue-bodies/t4-map-decision-line.md", "utf8")
	.replace(/\r\n/g, "\n")
	.replace(/\n+$/, "");
const anchor = "\n## Not yet specified";
const i = body.indexOf(anchor);
if (i === -1) {
	console.error("anchor '## Not yet specified' not found in map body");
	process.exit(1);
}
const next = `${body.slice(0, i)}\n${line}\n${body.slice(i)}\n`;
writeFileSync("plans/issue-bodies/map-body-new.md", next);
console.log("wrote plans/issue-bodies/map-body-new.md");
