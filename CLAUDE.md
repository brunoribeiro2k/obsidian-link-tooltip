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

- `main.ts` — almost the entire plugin. A CodeMirror 6 `ViewPlugin` listens for
  hover on link spans, resolves the external URL from the syntax tree / inline-link
  parser, and a floating tooltip element shows it. Also contains the settings tab.
  Imports `isExternalUrl` from `url.mjs`.
- `url.mjs` — dependency-free external-URL scheme allowlist (`isExternalUrl`). Kept
  as a standalone module rather than inlined in `main.ts` so it can be unit-tested
  with `node --test` without bundling `obsidian` / `@codemirror/*`.
- `test/is-external-url.test.mjs` — `node --test` cases for `isExternalUrl`:
  allowed schemes vs. rejected false positives (`c:\…`, `note:`, `tel:`, …).
- `styles.css` — tooltip styling. Must stay theme-aware (see Conventions).
- `manifest.json` — Obsidian plugin manifest. Keep `version` in sync with
  `package.json` and `versions.json` (the `npm version` flow does this for you).
- `versions.json` — maps each plugin version to the `minAppVersion` it requires.
  Written automatically by `version-bump.mjs`.
- `esbuild.config.mjs` — bundles `main.ts` → `main.js` (CJS, `obsidian` and
  `@codemirror/*` externalized).
- `version-bump.mjs` — run by `npm version`; writes the new version into
  `manifest.json` and `versions.json` and stages them.
- `.npmrc` — sets `tag-version-prefix=""` so `npm version` tags without a `v`
  prefix, as the community store requires.
- `.github/workflows/release.yml` — on a pushed tag, builds and creates a draft
  GitHub release with `main.js` / `manifest.json` / `styles.css` attached. Fails
  if the tag is not exactly the `manifest.json` version (no `v` prefix).
- `scripts/deploy.mjs` — local-only: builds and copies `main.js` / `manifest.json`
  / `styles.css` into a vault's plugin folder. Not part of the release flow.
- `main.js`, `data.json`, `*.map` are gitignored build/runtime artifacts. `main.js`
  ships only as a GitHub release asset, never committed.

## Commands

- `npm run dev` — esbuild watch (inline sourcemaps).
- `npm run build` — typecheck (`tsc -noEmit -skipLibCheck`) then production bundle.
- `npm test` — run the `isExternalUrl` unit tests via `node --test`.
- `npm run deploy -- --vault "/path/to/Vault"` — build + copy into a vault for
  local testing. Also accepts `--plugin-dir`, or `OBSIDIAN_VAULT` /
  `OBSIDIAN_PLUGIN_DIR` env vars.
- `npm version <patch|minor|major>` — cut a release version: runs
  `version-bump.mjs` to sync `manifest.json` + `versions.json`, then commits and
  creates a tag with **no `v` prefix**. Push it with `git push --follow-tags` to
  trigger `release.yml`, which builds and drafts the GitHub release. Working tree
  must be clean first.

Always run `npm run build` before considering a change done — it is the typecheck
gate. Run `npm test` (`node --test`) for the `isExternalUrl` unit tests.

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
