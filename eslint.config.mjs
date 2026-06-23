import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
	{
		// Build output, deps, the generated vault, and runtime data.
		ignores: ["main.js", "node_modules/", "test-vault/", "**/*.map", "data.json"],
	},
	{
		// Type-aware linting for the plugin source. This is what catches the
		// class of issues the Obsidian review flags (no-unsafe-*, etc.).
		files: ["**/*.ts"],
		extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: { ...globals.browser },
		},
	},
	{
		// Build, test, and helper scripts run under Node without type info.
		files: ["**/*.mjs"],
		extends: [js.configs.recommended],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
);
