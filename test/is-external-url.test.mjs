import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExternalUrl } from "../url.mjs";

describe("isExternalUrl", () => {
	it("allows expected external URL forms", () => {
		for (const url of [
			"https://example.com",
			"http://example.com/path?q=1",
			"ftp://files.example.com/archive.zip",
			"ftps://files.example.com/archive.zip",
			"file:///C:/Users/User/file.txt",
			"mailto:user@example.com",
			"//cdn.example.com/app.js",
			"www.example.com/docs",
		]) {
			assert.equal(isExternalUrl(url), true, url);
		}
	});

	it("rejects custom schemes and Windows paths", () => {
		for (const url of [
			"C:\\Users\\User\\notes.md",
			"c:\\temp\\notes.md",
			"note:daily-note",
			"tel:+15551234567",
			"obsidian://open?vault=Notes",
			"custom-scheme:value",
		]) {
			assert.equal(isExternalUrl(url), false, url);
		}
	});
});
