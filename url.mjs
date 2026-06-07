/*
 * External-URL detection.
 *
 * Kept as a standalone, dependency-free module (rather than inlined in main.ts)
 * so it can be unit-tested with `node --test` without bundling obsidian /
 * CodeMirror. main.ts imports isExternalUrl from here.
 */

// Explicit allowlist — avoids false positives from tokens like "c:\...",
// "note:foo", or any other "word:" that matches a permissive scheme pattern.
const EXTERNAL_URL_PATTERN =
	/^(?:https?:\/\/|ftps?:\/\/|file:\/\/|mailto:[^\s]+|ssh:\/\/|git:\/\/|obsidian:\/\/|\/\/|www\.)/i;

export function isExternalUrl(url) {
	return EXTERNAL_URL_PATTERN.test(url);
}
