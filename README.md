# Link Tooltip

Link Tooltip is a lightweight Obsidian plugin that shows where a hovered link points, in Live Preview and source mode.

A tooltip appears for any link that hides its destination behind a label: every Markdown link `[label](destination)` — an external URL or an internal note path — and aliased wikilinks `[[target|alias]]`. Bare links already show their destination as text (a raw URL, or an unaliased `[[Note]]`), so they get no tooltip.

Obsidian already shows native browser-style tooltips for real `<a href>` elements in Reading mode, so Reading mode is intentionally out of scope. This plugin targets the editor, where links are rendered by CodeMirror as spans and the destination is not available as an `href` attribute.

## What it does

- Registers a CodeMirror 6 extension for editor views.
- Detects hover on rendered Markdown links and wikilinks in Live Preview and source mode.
- Recovers the hovered link's destination from CodeMirror's syntax tree (shown as its literal target for internal links), not from hidden DOM spans.
- Shows the destination in a small floating tooltip near the cursor.
- Persists its settings with Obsidian's `loadData()` / `saveData()` plugin data APIs.

## Settings

- **Show tooltips for external links** — reveal the destination URL of a hovered external link. On by default.
- **Show tooltips for internal links** — reveal the target of a hovered internal link or aliased wikilink. On by default.
- **Debug logging** — enable only while troubleshooting hover detection.

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
3. Hover a Markdown link or aliased wikilink in Live Preview or source mode.
4. Filter the console for `link-tooltip`.

When debug logging is enabled, Obsidian should show a small notice and the console should show normal `console.log` entries prefixed with `[link-tooltip]`.

The hover diagnostics include the hovered position and the parsed link (its range, destination, kind, and whether it is aliased).

## Manual installation

1. Clone or download this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Create a folder named `link-tooltip` inside your vault's `.obsidian/plugins/` directory.
5. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/link-tooltip/`.
6. Restart Obsidian or reload plugins.
7. Enable **Link Tooltip** in Obsidian's Community plugins settings.

## Community plugins

Install directly from Obsidian:

1. Open **Settings → Community plugins**.
2. Make sure Safe mode is off, then click **Browse**.
3. Search for **Link Tooltip** and click **Install**.
4. Enable the plugin.

### BRAT (pre-release)

To test a pre-release build with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable the BRAT plugin.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `brunoribeiro2k/obsidian-link-tooltip`.
4. Enable **Link Tooltip** in Community plugins settings.
