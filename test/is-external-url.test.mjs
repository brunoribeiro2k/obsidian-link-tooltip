import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExternalUrl } from "../url.mjs";

describe("isExternalUrl", () => {
	it("accepts the allowlisted external schemes", () => {
		for (const url of [
			"https://example.com",
			"http://example.com/path?q=1",
			"ftp://files.example.com/archive.zip",
			"ftps://files.example.com/archive.zip",
			"file:///home/user/file.txt",
			"mailto:user@example.com",
			"ssh://git@host/repo.git",
			"git://host/repo.git",
			// obsidian:// is intentionally external here (a deliberate divergence
			// from the upstream fork, which rejected it).
			"obsidian://open?vault=Notes",
			"//cdn.example.com/app.js",
			"www.example.com/docs",
		]) {
			assert.equal(isExternalUrl(url), true, url);
		}
	});

	it("rejects custom schemes, Windows paths, and bare tokens", () => {
		for (const url of [
			"C:\\Users\\User\\notes.md",
			"c:\\temp\\notes.md",
			"note:daily-note",
			"tel:+15551234567",
			"javascript:alert(1)",
			"custom-scheme:value",
			"relative/path/note.md",
			"",
		]) {
			assert.equal(isExternalUrl(url), false, url);
		}
	});
});
