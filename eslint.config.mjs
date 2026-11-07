import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
	{
		// Build output, deps, the generated vault, and runtime data.
		ignores: ["main.js", "node_modules/", "test-vault/", "**/*.map", "data.json"],
	},
	// The official guideline checks: ESLint core, typescript-eslint
	// type-checked rules, and the Obsidian-specific rules the review applies.
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					// url.mjs / visible.mjs are already in the project via main.ts.
					allowDefaultProject: [
						"esbuild.config.mjs",
						"eslint.config.mjs",
						"version-bump.mjs",
						"scripts/*.mjs",
						"test/*.mjs",
					],
					// The scripts and tests above are a handful of small files, so
					// the default project's 8-file guard is safe to raise.
					maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 16,
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		// The plugin itself, plus the dependency-free helpers it bundles.
		files: ["*.ts", "url.mjs", "visible.mjs"],
		languageOptions: { globals: { ...globals.browser } },
		rules: { "@typescript-eslint/no-explicit-any": "error" },
	},
	{
		// Unit tests, build and helper scripts run under Node, never inside
		// Obsidian: Node built-ins, `.obsidian` paths and logging are fine there.
		files: ["test/**/*.mjs", "scripts/**/*.mjs", "*.config.mjs", "version-bump.mjs"],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			"obsidianmd/rule-custom-message": "off",
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/hardcoded-config-path": "off",
		},
	},
	{
		// node:test's describe()/it() return promises the runner already tracks.
		files: ["test/**/*.mjs"],
		rules: { "@typescript-eslint/no-floating-promises": "off" },
	},
]);
