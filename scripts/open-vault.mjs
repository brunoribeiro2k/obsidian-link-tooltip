/*
 * Open `test-vault/` in Obsidian, registering it as a vault first if needed.
 *
 *   make open        (or: node scripts/open-vault.mjs [vault-dir])
 *
 * Obsidian only opens folders listed in its `obsidian.json`. Registering means
 * adding an entry there, which is only safe while Obsidian is closed: a running
 * Obsidian keeps the list in memory, ignores the new entry, and overwrites the
 * file on its next save. So the first run needs Obsidian closed; after that the
 * vault is known and this works with Obsidian open too.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultDir = path.resolve(process.argv[2] ?? path.join(repoRoot, "test-vault"));

if (!existsSync(vaultDir)) {
	console.error(`${vaultDir} doesn't exist. Run \`make vault\` first.`);
	process.exit(1);
}

const configPath = path.join(configDir(), "obsidian.json");
const config = existsSync(configPath) ? JSON.parse(await readFile(configPath, "utf8")) : {};
config.vaults ??= {};
const registered = Object.values(config.vaults).some((vault) => path.resolve(vault.path) === vaultDir);

if (!registered) {
	if (isObsidianRunning()) {
		console.error(
			[
				`${vaultDir} isn't registered as an Obsidian vault yet.`,
				"Registering it needs Obsidian closed (a running Obsidian would overwrite the change).",
				"Quit Obsidian and run `make open` again. This is only needed once.",
			].join("\n"),
		);
		process.exit(1);
	}
	config.vaults[randomBytes(8).toString("hex")] = { path: vaultDir, ts: Date.now() };
	await writeFile(configPath, JSON.stringify(config));
	console.log(`Registered ${vaultDir} in ${configPath}`);
}

launch(vaultDir);
console.log(`Opening ${vaultDir} in Obsidian`);

function configDir() {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "obsidian");
	if (process.platform === "win32") return path.join(process.env.APPDATA ?? os.homedir(), "obsidian");
	return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "obsidian");
}

function isObsidianRunning() {
	try {
		if (process.platform === "win32") {
			return execFileSync("tasklist", ["/FI", "IMAGENAME eq Obsidian.exe"], { encoding: "utf8" }).includes(
				"Obsidian.exe",
			);
		}
		execFileSync("pgrep", ["-xi", "obsidian"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function launch(dir) {
	// Linux: the binary takes a folder path. Elsewhere, the obsidian:// URI
	// opens the registered vault containing the path.
	const uri = `obsidian://open?path=${encodeURIComponent(dir)}`;
	const [command, args] =
		process.platform === "darwin"
			? ["open", [uri]]
			: process.platform === "win32"
				? ["cmd", ["/c", "start", "", uri]]
				: ["obsidian", [dir]];
	spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}
