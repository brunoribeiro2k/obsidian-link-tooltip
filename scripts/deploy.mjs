import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const releaseFiles = ["main.js", "manifest.json", "styles.css"];
const args = process.argv.slice(2);

const pluginDir =
	getArgValue(args, "--plugin-dir") ??
	process.env.OBSIDIAN_PLUGIN_DIR ??
	getVaultPluginDir();

if (!pluginDir) {
	console.error(
		[
			"Missing deploy target.",
			"",
			"Use one of:",
			'  npm run deploy -- --vault "/path/to/Vault"',
			'  npm run deploy -- --plugin-dir "/path/to/Vault/.obsidian/plugins/link-tooltip"',
			"",
			"Or set OBSIDIAN_VAULT / OBSIDIAN_PLUGIN_DIR in your environment.",
		].join("\n"),
	);
	process.exit(1);
}

await mkdir(pluginDir, { recursive: true });

for (const file of releaseFiles) {
	const source = path.join(repoRoot, file);
	await access(source);
	await copyFile(source, path.join(pluginDir, file));
}

console.log(`Deployed ${manifest.name} to ${pluginDir}`);

function getVaultPluginDir() {
	const vault = getArgValue(args, "--vault") ?? process.env.OBSIDIAN_VAULT;
	if (!vault) {
		return null;
	}

	return path.join(vault, ".obsidian", "plugins", manifest.id);
}

function getArgValue(argv, name) {
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === name) {
			return argv[index + 1] ?? null;
		}

		if (arg.startsWith(`${name}=`)) {
			return arg.slice(name.length + 1);
		}
	}

	return null;
}
