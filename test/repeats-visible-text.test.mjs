import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repeatsVisibleText } from "../visible.mjs";

describe("repeatsVisibleText", () => {
	it("matches identical text, ignoring surrounding whitespace", () => {
		assert.equal(repeatsVisibleText("https://x.com", "https://x.com", false), true);
		assert.equal(repeatsVisibleText(" Note ", "Note", true), true);
	});

	it("ignores the .md extension of internal paths, before any subpath", () => {
		assert.equal(repeatsVisibleText("Projects/2026/Note.md", "Projects/2026/Note", true), true);
		assert.equal(repeatsVisibleText("Note.md#Heading", "Note#Heading", true), true);
		assert.equal(repeatsVisibleText("Note.MD", "Note", true), true);
	});

	it("keeps the extension significant for external links", () => {
		assert.equal(repeatsVisibleText("https://x.com/readme.md", "https://x.com/readme", false), false);
	});

	it("treats a hidden folder or a different label as new information", () => {
		assert.equal(repeatsVisibleText("Projects/2026/Note.md", "Note", true), false);
		assert.equal(repeatsVisibleText("Target", "a friendly alias", true), false);
		assert.equal(repeatsVisibleText("https://x.com", "docs", false), false);
	});

	it("is case-sensitive, so a case-corrected path still shows", () => {
		assert.equal(repeatsVisibleText("Target.md", "target", true), false);
	});
});
