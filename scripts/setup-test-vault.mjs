/*
 * Build the gitignored `test-vault/` from version-controlled fixtures.
 *
 * The tree-based link detection cannot be exercised under plain `node --test`
 * (it needs a live CodeMirror editor with Obsidian's markdown parse), so the
 * test-vault is the verification surface: open it in Obsidian to experiment
 * visually, or point a future editor-level harness at it. The vault itself is
 * gitignored; the sample notes live in `test/fixtures/vault/` so they stay in
 * version control. Re-run this any time to refresh the vault and redeploy the
 * latest build into it. Non-destructive: it overwrites the seeded files but
 * leaves anything else in the vault (Obsidian's workspace, your scratch notes)
 * untouched.
 */
import { access, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultDir = path.join(repoRoot, "test-vault");
const fixturesDir = path.join(repoRoot, "test", "fixtures", "vault");
const releaseFiles = ["main.js", "manifest.json", "styles.css"];

const manifest = JSON.parse(await readFile(path.join(repoRoot, "manifest.json"), "utf8"));
const pluginDir = path.join(vaultDir, ".obsidian", "plugins", manifest.id);

// Fail loudly rather than deploy a stale or missing bundle.
try {
	await access(path.join(repoRoot, "main.js"));
} catch {
	console.error("main.js not found — run `npm run build` first (or `npm run setup-vault`).");
	process.exit(1);
}

// 1. Seed the sample notes from the committed fixtures.
await mkdir(vaultDir, { recursive: true });
for (const entry of await readdir(fixturesDir)) {
	await copyFile(path.join(fixturesDir, entry), path.join(vaultDir, entry));
}

// 2. Deploy the current build into the vault's plugin folder.
await mkdir(pluginDir, { recursive: true });
for (const file of releaseFiles) {
	await copyFile(path.join(repoRoot, file), path.join(pluginDir, file));
}

// 3. Enable the plugin so the vault works the moment Obsidian opens it.
await writeFile(
	path.join(vaultDir, ".obsidian", "community-plugins.json"),
	`${JSON.stringify([manifest.id], null, 2)}\n`,
);

console.log(`Test vault ready at ${vaultDir}`);
console.log("Open it in Obsidian (Open folder as vault) to experiment visually.");
