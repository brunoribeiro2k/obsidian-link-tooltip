/*
 * "Already visible" check: whether a tooltip would only repeat the text a link
 * already shows (its label or alias, or its target when it has neither).
 *
 * Standalone and dependency-free, like url.mjs, so `node --test` can cover it
 * without bundling obsidian / CodeMirror. main.ts imports it from here.
 */

/**
 * @param {string} tooltip the text the tooltip would show
 * @param {string} visible the text the link shows in the editor
 * @param {boolean} internal whether the link points into the vault; internal
 *   links usually omit the `.md` extension, so it's ignored on the path part
 *   (before any `#heading` / `#^block` subpath)
 * @returns {boolean}
 */
export function repeatsVisibleText(tooltip, visible, internal) {
	const normalize = (text) => {
		const trimmed = text.trim();
		return internal ? trimmed.replace(/\.md(?=#|$)/i, "") : trimmed;
	};

	return normalize(tooltip) === normalize(visible);
}
