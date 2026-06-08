import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinationToShow, parseLinks } from "../links.mjs";

/** Parse a single line that starts at document offset 0. */
function parseLine(text) {
	return parseLinks(text, 0);
}

/** Parse a line and return the one link it should contain. */
function parseOne(text) {
	const links = parseLine(text);
	assert.equal(links.length, 1, `expected one link in: ${text}`);
	return links[0];
}

describe("parseLinks — Markdown links", () => {
	it("treats every Markdown link as aliased and reads its destination", () => {
		const link = parseOne("see [click here](https://example.com) now");
		assert.equal(link.kind, "external");
		assert.equal(link.aliased, true);
		assert.equal(link.destination, "https://example.com");
		assert.equal(destinationToShow(link), "https://example.com");
	});

	it("shows the destination even when the label equals it", () => {
		const link = parseOne("[https://x.com](https://x.com)");
		assert.equal(destinationToShow(link), "https://x.com");
	});

	it("classifies non-external destinations as internal (literal target)", () => {
		const link = parseOne("[some label](other-note.md)");
		assert.equal(link.kind, "internal");
		assert.equal(link.destination, "other-note.md");
		assert.equal(destinationToShow(link), "other-note.md");
	});

	it("unwraps angle-bracket destinations with spaces", () => {
		const link = parseOne("[x](<https://e.com/a b>)");
		assert.equal(link.destination, "https://e.com/a b");
	});

	it("ignores image embeds", () => {
		assert.deepEqual(parseLine("![alt](https://example.com/img.png)"), []);
	});

	it("spans the full link range from the opening bracket to the closing paren", () => {
		const link = parseOne("[a](https://e.com)");
		assert.equal(link.from, 0);
		assert.equal(link.to, "[a](https://e.com)".length);
	});
});

describe("parseLinks — wikilinks", () => {
	it("does not flag an unaliased wikilink (text already is the target)", () => {
		const link = parseOne("[[Note]]");
		assert.equal(link.kind, "internal");
		assert.equal(link.aliased, false);
		assert.equal(link.destination, "Note");
		assert.equal(destinationToShow(link), null);
	});

	it("shows the target for an aliased wikilink", () => {
		const link = parseOne("[[Real Note Name|aliased text]]");
		assert.equal(link.kind, "internal");
		assert.equal(link.aliased, true);
		assert.equal(link.destination, "Real Note Name");
		assert.equal(destinationToShow(link), "Real Note Name");
	});

	it("keeps headings and blocks in the literal target", () => {
		const link = parseOne("[[Note#Section|label]]");
		assert.equal(link.destination, "Note#Section");
	});

	it("ignores wikilink embeds", () => {
		assert.deepEqual(parseLine("![[Note]]"), []);
	});
});

describe("parseLinks — multiple links on a line", () => {
	it("returns each link with its own range", () => {
		const links = parseLine("[a](https://a.com) and [[B|b]]");
		assert.equal(links.length, 2);
		assert.equal(links[0].destination, "https://a.com");
		assert.equal(links[1].destination, "B");
	});
});
