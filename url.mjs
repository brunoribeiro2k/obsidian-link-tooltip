/*
 * External-URL detection.
 *
 * Kept as a standalone, dependency-free module (rather than inlined in main.ts)
 * so it can be unit-tested with `node --test` without bundling obsidian /
 * CodeMirror. main.ts imports isExternalUrl from here.
 */

// Explicit allowlist of prefixes that mark a link as external. Keeping each
// alternative as its own entry makes the set easy to scan and extend, and avoids
// false positives like "c:\..." or "note:foo" that a permissive "scheme:"
// pattern would catch.
const EXTERNAL_URL_PREFIXES = [
	/https?:\/\//, // http, https
	/ftps?:\/\//, // ftp, ftps
	/file:\/\//,
	/mailto:[^\s]+/,
	/\/\//, // protocol-relative (//host/path)
	/www\./,
];

const EXTERNAL_URL_PATTERN = new RegExp(
	`^(?:${EXTERNAL_URL_PREFIXES.map((prefix) => prefix.source).join("|")})`,
	"i",
);

export function isExternalUrl(url) {
	return EXTERNAL_URL_PATTERN.test(url);
}
