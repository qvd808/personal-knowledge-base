import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeTmpRoot(prefix = "pkb-test-"): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanup(root: string): void {
	fs.rmSync(root, { recursive: true, force: true });
}

export function writeFile(
	root: string,
	relative: string,
	content: string,
): void {
	const absolute = path.join(root, relative);
	fs.mkdirSync(path.dirname(absolute), { recursive: true });
	fs.writeFileSync(absolute, content);
}

export function readFile(root: string, relative: string): string {
	return fs.readFileSync(path.join(root, relative), "utf8");
}

export function exists(root: string, relative: string): boolean {
	return fs.existsSync(path.join(root, relative));
}
