import fs from "node:fs";
import path from "node:path";

export const IMAGES_DIR = "images";
export const EXCALIDRAW_DIR = "Excalidraw";
export const TEMPLATES_DIR = "templates";
export const OBSIDIAN_DIR = ".obsidian";

/**
 * The #16 boundary: workspace state and caches stay local, so the secrets
 * scan never looks at them. Everything else under `.obsidian/` is committable
 * config and gets scanned.
 */
const LOCAL_OBSIDIAN_FILES = new Set([
	"workspace.json",
	"workspace-mobile.json",
	"workspaces.json",
]);
const LOCAL_OBSIDIAN_DIRS = new Set(["cache"]);

export interface VaultFile {
	/** POSIX-style path relative to the vault root. */
	relativePath: string;
	absolutePath: string;
}

export interface Vault {
	root: string;
	/** Notes: .md files outside .obsidian/, images/, Excalidraw/, templates/ and dot-paths. */
	notes: VaultFile[];
	/** Excalidraw drawings: wikilink targets and kebab-checked, but not notes. */
	drawings: VaultFile[];
	/** Files in the central images/ folder. */
	images: VaultFile[];
	/** Every non-note file an embed can point at (images included). */
	attachments: VaultFile[];
	/** Committable .obsidian/ config per the #16 boundary. */
	obsidianConfigs: VaultFile[];
}

function toPosix(relative: string): string {
	return relative.split(path.sep).join("/");
}

function walk(dir: string, base: string, out: VaultFile[]): void {
	const entries = fs
		.readdirSync(dir, { withFileTypes: true })
		.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, base, out);
		} else if (entry.isFile()) {
			out.push({
				relativePath: toPosix(path.relative(base, full)),
				absolutePath: full,
			});
		}
	}
}

function isDotPath(relativePath: string): boolean {
	return relativePath.split("/").some((segment) => segment.startsWith("."));
}

function topDirOf(relativePath: string): string | undefined {
	const slash = relativePath.indexOf("/");
	return slash === -1 ? undefined : relativePath.slice(0, slash);
}

/**
 * Reads the vault tree once and classifies every file per the #6/#7 layout:
 * notes live everywhere except the central images/ folder, the Excalidraw/
 * plugin folder, and templates/; dot-paths (`.trash/`, …) are not content.
 */
export function scanVault(root: string): Vault {
	const vault: Vault = {
		root,
		notes: [],
		drawings: [],
		images: [],
		attachments: [],
		obsidianConfigs: [],
	};

	const obsidianRoot = path.join(root, OBSIDIAN_DIR);
	if (fs.existsSync(obsidianRoot) && fs.statSync(obsidianRoot).isDirectory()) {
		const files: VaultFile[] = [];
		walk(obsidianRoot, root, files);
		for (const file of files) {
			const inside = file.relativePath.slice(OBSIDIAN_DIR.length + 1);
			const segments = inside.split("/");
			const first = segments[0] ?? "";
			if (LOCAL_OBSIDIAN_DIRS.has(first)) continue;
			if (segments.length === 1 && LOCAL_OBSIDIAN_FILES.has(first)) continue;
			vault.obsidianConfigs.push(file);
		}
	}

	const files: VaultFile[] = [];
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			walk(full, root, files);
		} else if (entry.isFile()) {
			files.push({ relativePath: entry.name, absolutePath: full });
		}
	}

	for (const file of files) {
		if (isDotPath(file.relativePath)) continue;
		const topDir = topDirOf(file.relativePath);
		const isMarkdown = file.relativePath.toLowerCase().endsWith(".md");
		if (topDir === IMAGES_DIR) {
			vault.images.push(file);
			vault.attachments.push(file);
		} else if (topDir === EXCALIDRAW_DIR) {
			if (isMarkdown) {
				vault.drawings.push(file);
			} else {
				vault.attachments.push(file);
			}
		} else if (topDir === TEMPLATES_DIR) {
			// Template stubs for Obsidian's core Templates plugin — not vault notes.
		} else if (isMarkdown) {
			vault.notes.push(file);
		} else {
			vault.attachments.push(file);
		}
	}

	return vault;
}
