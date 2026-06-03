# Link Tooltip

Link Tooltip is a lightweight Obsidian plugin that shows the URL behind a hovered external Markdown link in Live Preview and source mode.

Obsidian already shows native browser-style tooltips for real `<a href>` elements in Reading mode, so Reading mode is intentionally out of scope. This plugin targets the editor, where external links are rendered by CodeMirror as spans and the URL is not available as an `href` attribute.

## What it does

- Registers a CodeMirror 6 extension for editor views.
- Detects hover on rendered external links in Live Preview and source mode.
- Reads the hovered link destination from the CodeMirror syntax tree and document text, not from hidden DOM spans.
- Shows the URL in the status bar by default.
- Optionally shows the full URL in a small floating tooltip near the cursor.
- Persists the display mode setting with Obsidian's `loadData()` / `saveData()` plugin data APIs.

## Settings

The plugin defaults to status bar mode. Long status bar URLs are left-truncated with a leading ellipsis. The default status bar length is 120 characters and can be changed in settings.

Enable **Show floating tooltip** in the plugin settings to use the dark tooltip pill instead.

## Install into a vault

For local testing, use the deploy script. It builds the plugin, creates the plugin folder if needed, and copies `main.js`, `manifest.json`, and `styles.css`.

```sh
npm install
npm run deploy -- --vault "/path/to/Vault"
```

You can also target the plugin folder directly:

```sh
npm run deploy -- --plugin-dir "/path/to/Vault/.obsidian/plugins/link-tooltip"
```

For repeated local deploys, set `OBSIDIAN_VAULT` or `OBSIDIAN_PLUGIN_DIR` in your shell and run `npm run deploy`.

After deploying, restart Obsidian or reload plugins, then enable **Link Tooltip** in Obsidian's Community plugins settings.

## Troubleshooting

Open Obsidian's developer console with `Ctrl+Shift+I` on Windows/Linux or `Cmd+Option+I` on macOS, then check the **Console** tab.

If the plugin enabled but hover display is not working:

1. Open **Settings -> Community plugins -> Link Tooltip**.
2. Enable **Debug logging**.
3. Hover an external Markdown link in Live Preview or source mode.
4. Filter the console for `link-tooltip`.

When debug logging is enabled, Obsidian should show a small notice and the console should show normal `console.log` entries prefixed with `[link-tooltip]`.

The hover diagnostics include the hovered DOM classes, nearby syntax-tree node path, and extracted URL.

## Manual installation

1. Clone or download this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Create a folder named `link-tooltip` inside your vault's `.obsidian/plugins/` directory.
5. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/link-tooltip/`.
6. Restart Obsidian or reload plugins.
7. Enable **Link Tooltip** in Obsidian's Community plugins settings.

## Community plugins

This plugin is intended to be submitted to the Obsidian community plugins list after testing and release preparation.
