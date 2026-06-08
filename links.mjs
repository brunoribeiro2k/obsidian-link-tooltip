/*
 * Link parsing for the editor tooltip.
 *
 * Kept as a standalone, dependency-free module (rather than inlined in main.ts)
 * so it can be unit-tested with `node --test` without bundling obsidian /
 * CodeMirror. main.ts imports parseLinks / destinationToShow from here.
 *
 * The plugin shows a tooltip for any link that carries an explicit label/alias
 * component — every Markdown link `[label](dest)` (the destination is hidden in
 * the editor regardless) and aliased wikilinks `[[target|alias]]` — even when the
 * visible text equals the destination. Bare links (raw autolinks, unaliased
 * `[[Note]]`) show nothing, so they are never parsed as a tooltip target.
 */

import { isExternalUrl } from "./url.mjs";

/**
 * @typedef {Object} ParsedLink
 * @property {number} from        Document offset of the link start.
 * @property {number} to          Document offset of the link end.
 * @property {string} destination Literal target to show (URL or link path).
 * @property {"external" | "internal"} kind
 * @property {boolean} aliased    Whether the link hides its destination behind text.
 */

/**
 * Parse every link on a single line of source text.
 *
 * @param {string} lineText
 * @param {number} lineStart Document offset of the line's first character.
 * @returns {ParsedLink[]}
 */
export function parseLinks(lineText, lineStart) {
	/** @type {ParsedLink[]} */
	const links = [];

	for (let index = 0; index < lineText.length; index += 1) {
		if (
			lineText[index] !== "[" ||
			isEscaped(lineText, index) ||
			isImageMarker(lineText, index)
		) {
			continue;
		}

		if (lineText[index + 1] === "[") {
			const wikilink = parseWikilinkAt(lineText, lineStart, index);
			if (wikilink) {
				links.push(wikilink.link);
				index = wikilink.nextIndex;
			}
			continue;
		}

		const markdown = parseMarkdownLinkAt(lineText, lineStart, index);
		if (markdown) {
			links.push(markdown.link);
			index = markdown.nextIndex;
		}
	}

	return links;
}

/**
 * The destination to display for a link, or null when the link is bare and
 * already shows its destination (an unaliased wikilink).
 *
 * @param {ParsedLink} link
 * @returns {string | null}
 */
export function destinationToShow(link) {
	return link.aliased ? link.destination : null;
}

/**
 * @param {string} lineText
 * @param {number} lineStart
 * @param {number} index Offset of the opening `[`.
 * @returns {{ link: ParsedLink, nextIndex: number } | null}
 */
function parseMarkdownLinkAt(lineText, lineStart, index) {
	const labelEnd = findClosingBracket(lineText, index);
	if (labelEnd === -1 || lineText[labelEnd + 1] !== "(") {
		return null;
	}

	const destinationStart = labelEnd + 2;
	const destinationEnd = findInlineDestinationEnd(lineText, destinationStart);
	if (destinationEnd === -1) {
		return null;
	}

	const destination = parseInlineDestination(
		lineText.slice(destinationStart, destinationEnd),
	);
	if (!destination) {
		return null;
	}

	const normalized = normalizeUrlToken(destination);

	return {
		link: {
			from: lineStart + index,
			to: lineStart + destinationEnd + 1,
			destination: normalized,
			kind: isExternalUrl(normalized) ? "external" : "internal",
			aliased: true,
		},
		nextIndex: destinationEnd,
	};
}

/**
 * @param {string} lineText
 * @param {number} lineStart
 * @param {number} index Offset of the first `[` of `[[`.
 * @returns {{ link: ParsedLink, nextIndex: number } | null}
 */
function parseWikilinkAt(lineText, lineStart, index) {
	const innerStart = index + 2;
	const closeStart = findWikilinkClose(lineText, innerStart);
	if (closeStart === -1) {
		return null;
	}

	const inner = lineText.slice(innerStart, closeStart);
	const pipe = findUnescaped(inner, "|", 0);
	const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
	if (!target) {
		return null;
	}

	return {
		link: {
			from: lineStart + index,
			to: lineStart + closeStart + 2,
			destination: target,
			kind: "internal",
			aliased: pipe !== -1,
		},
		nextIndex: closeStart + 1,
	};
}

function findWikilinkClose(text, start) {
	for (let index = start; index < text.length - 1; index += 1) {
		if (text[index] === "]" && text[index + 1] === "]" && !isEscaped(text, index)) {
			return index;
		}
	}

	return -1;
}

function parseInlineDestination(text) {
	const body = text.trim();
	if (!body) {
		return null;
	}

	if (body.startsWith("<")) {
		const angleEnd = findUnescaped(body, ">", 1);
		return angleEnd === -1 ? null : body.slice(1, angleEnd);
	}

	let depth = 0;
	for (let index = 0; index < body.length; index += 1) {
		const char = body[index];

		if (char === "\\") {
			index += 1;
			continue;
		}

		if (char === "(") {
			depth += 1;
			continue;
		}

		if (char === ")") {
			if (depth === 0) {
				return body.slice(0, index);
			}

			depth -= 1;
			continue;
		}

		if (/\s/.test(char) && depth === 0) {
			return body.slice(0, index);
		}
	}

	return body;
}

function findClosingBracket(text, start) {
	let depth = 0;

	for (let index = start + 1; index < text.length; index += 1) {
		const char = text[index];

		if (char === "\\") {
			index += 1;
			continue;
		}

		if (char === "[") {
			depth += 1;
			continue;
		}

		if (char === "]") {
			if (depth === 0) {
				return index;
			}

			depth -= 1;
		}
	}

	return -1;
}

function findInlineDestinationEnd(text, start) {
	let depth = 0;

	for (let index = start; index < text.length; index += 1) {
		const char = text[index];

		if (char === "\\") {
			index += 1;
			continue;
		}

		if (char === "(") {
			depth += 1;
			continue;
		}

		if (char === ")") {
			if (depth === 0) {
				return index;
			}

			depth -= 1;
		}
	}

	return -1;
}

function findUnescaped(text, needle, start) {
	for (let index = start; index < text.length; index += 1) {
		if (text[index] === needle && !isEscaped(text, index)) {
			return index;
		}
	}

	return -1;
}

function isImageMarker(text, bracketIndex) {
	return (
		bracketIndex > 0 &&
		text[bracketIndex - 1] === "!" &&
		!isEscaped(text, bracketIndex - 1)
	);
}

function isEscaped(text, index) {
	let slashCount = 0;
	for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
		slashCount += 1;
	}

	return slashCount % 2 === 1;
}

function normalizeUrlToken(text) {
	let url = text.trim();

	if (url.startsWith("<") && url.endsWith(">")) {
		url = url.slice(1, -1).trim();
	}

	return url.replace(/\\([\\`*_[\]{}()#+\-.!<>])/g, "$1");
}
