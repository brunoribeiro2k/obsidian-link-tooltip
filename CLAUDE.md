# CLAUDE.md

Guidance for working in this repository.

## What this is

**Link Tooltip** is an Obsidian plugin that shows the destination URL of a hovered
external Markdown link while editing — in **Live Preview** and **source mode**.

Scope decision (intentional): Reading mode is **out of scope**. Obsidian already
renders real `<a href>` elements with native browser tooltips there. This plugin
only targets the editor, where CodeMirror renders links as spans with no `href`
attribute, so the URL must be recovered from the CodeMirror syntax tree and the
document text.

Goal: prepare this for submission to the **Obsidian community plugins** list.

## Layout

- `main.ts` — the entire plugin. A CodeMirror 6 `ViewPlugin` listens for hover on
  link spans, resolves the external URL from the syntax tree / inline-link parser,
  and a floating tooltip element shows it. Also contains the settings tab.
- `styles.css` — tooltip styling. Must stay theme-aware (see Conventions).
- `manifest.json` — Obsidian plugin manifest. Keep `version` in sync with
  `package.json` and (once added) `versions.json`.
- `esbuild.config.mjs` — bundles `main.ts` → `main.js` (CJS, `obsidian` and
  `@codemirror/*` externalized).
- `scripts/deploy.mjs` — local-only: builds and copies `main.js` / `manifest.json`
  / `styles.css` into a vault's plugin folder. Not part of the release flow.
- `main.js`, `data.json`, `*.map` are gitignored build/runtime artifacts. `main.js`
  ships only as a GitHub release asset, never committed.

## Commands

- `npm run dev` — esbuild watch (inline sourcemaps).
- `npm run build` — typecheck (`tsc -noEmit -skipLibCheck`) then production bundle.
- `npm run deploy -- --vault "/path/to/Vault"` — build + copy into a vault for
  local testing. Also accepts `--plugin-dir`, or `OBSIDIAN_VAULT` /
  `OBSIDIAN_PLUGIN_DIR` env vars.

Always run `npm run build` before considering a change done — it is the only
typecheck gate (there is no test suite).

## Conventions / hard rules

These reflect Obsidian community-plugin review requirements — keep them holding:

- **Theme-aware styling.** No hardcoded colors in `styles.css`; use CSS variables
  so light/dark/custom themes work.
- **Pop-out window safe.** Do not reach for the global `window` / `document`. The
  editor can live in a separate window; create, append, and position UI relative to
  the view's own window (`view.dom.ownerDocument` / `view.dom.win`).
- **Sentence case** in all UI text (settings names/descriptions, notices).
- **No `innerHTML`.** Build DOM with the Obsidian/DOM helpers (`setText`,
  `createDiv`, `addClass`, …).
- **Clean teardown.** Every listener/element created must be removed on
  `ViewPlugin.destroy()` / plugin `onunload`.
- `console.log` only behind the opt-in **Debug logging** setting.
- Keep `manifest.json` `description` concise, ending with a period, not starting
  with "This plugin", and not containing the word "Obsidian".

## Submission tracking

Readiness work is tracked as GitHub issues on this repo (labels `submission` and
`blocker`). Check open issues for the current state before starting submission work.
