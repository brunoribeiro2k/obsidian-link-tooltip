import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { syntaxTree } from "@codemirror/language";
import { EditorView, hoverTooltip } from "@codemirror/view";

interface LinkTooltipSettings {
	debugLogging: boolean;
}

const DEFAULT_SETTINGS: LinkTooltipSettings = {
	debugLogging: false,
};

export default class LinkTooltipPlugin extends Plugin {
	settings: LinkTooltipSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new LinkTooltipSettingTab(this.app, this));
		this.registerEditorExtension(createLinkTooltipExtension(this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	debug(message: string, ...data: unknown[]): void {
		if (!this.settings.debugLogging) {
			return;
		}

		console.log(`[link-tooltip] ${message}`, ...data);
	}
}

class LinkTooltipSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: LinkTooltipPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Debug logging")
			.setDesc("Log hover diagnostics to the Obsidian developer console.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.debugLogging)
					.onChange(async (value) => {
						this.plugin.settings.debugLogging = value;
						if (value) {
							new Notice("Link Tooltip debug logging enabled");
						}
						this.plugin.debug("debug logging enabled");
						await this.plugin.saveSettings();
					});
			});
	}
}

function createLinkTooltipExtension(plugin: LinkTooltipPlugin) {
	// Delegate the whole hover lifecycle — positioning, teardown, pop-out
	// window placement, hide-on-scroll — to CodeMirror's own tooltip system.
	return hoverTooltip(
		(view, pos) => {
			const link = getExternalLinkAt(view, pos);

			if (plugin.settings.debugLogging) {
				plugin.debug("link hover", {
					pos,
					nodePath: getSyntaxNodePath(view, pos),
					url: link?.url ?? null,
				});
			}

			if (!link) {
				return null;
			}

			return {
				pos: link.from,
				end: link.to,
				create() {
					// Build in the view's own document so the element is valid in
					// a detached pop-out window; CodeMirror appends it into that
					// window's tooltip layer.
					const dom = view.dom.ownerDocument.createElement("div");
					dom.addClass("link-tooltip-content");
					dom.setText(link.url);
					return { dom };
				},
			};
		},
		{ hideOnChange: true },
	);
}

interface ExternalLink {
	url: string;
	from: number;
	to: number;
}

function getExternalLinkAt(view: EditorView, pos: number): ExternalLink | null {
	const tree = syntaxTree(view.state);
	let node: typeof tree.topNode | null = tree.resolveInner(pos, -1);
	let linkRange: { from: number; to: number } | null = null;

	while (node) {
		if (isUrlNode(node.name)) {
			const candidate = normalizeUrlToken(
				view.state.doc.sliceString(node.from, node.to),
			);
			if (isExternalUrl(candidate)) {
				return { url: candidate, from: node.from, to: node.to };
			}
		}

		if (isPotentialLinkNode(node.name)) {
			linkRange = { from: node.from, to: node.to };

			const urlFromNode = getExternalUrlInRange(view, node.from, node.to);
			if (urlFromNode) {
				return { url: urlFromNode, from: node.from, to: node.to };
			}

			const linkFromLine = getExternalInlineUrlFromLine(
				view,
				pos,
				node.from,
				node.to,
			);
			if (linkFromLine) {
				return linkFromLine;
			}

			const nodeText = view.state.doc.sliceString(node.from, node.to);
			const parsedUrl = extractExternalUrl(nodeText);
			if (parsedUrl) {
				return { url: parsedUrl, from: node.from, to: node.to };
			}
		}

		node = node.parent;
	}

	if (linkRange) {
		const linkFromLine = getExternalInlineUrlFromLine(
			view,
			pos,
			linkRange.from,
			linkRange.to,
		);
		if (linkFromLine) {
			return linkFromLine;
		}
	}

	return getExternalInlineUrlFromLine(view, pos, pos, pos);
}

function getExternalInlineUrlFromLine(
	view: EditorView,
	pos: number,
	linkFrom: number,
	linkTo: number,
): ExternalLink | null {
	const line = view.state.doc.lineAt(pos);
	const links = parseInlineLinks(line.text, line.from);

	for (const link of links) {
		if (
			isInRange(pos, link.fullFrom, link.fullTo) ||
			rangesOverlap(linkFrom, linkTo, link.labelFrom, link.labelTo)
		) {
			return { url: link.destination, from: link.fullFrom, to: link.fullTo };
		}
	}

	return null;
}

interface InlineLink {
	fullFrom: number;
	fullTo: number;
	labelFrom: number;
	labelTo: number;
	destination: string;
}

function parseInlineLinks(lineText: string, lineStart: number): InlineLink[] {
	const links: InlineLink[] = [];

	for (let index = 0; index < lineText.length; index += 1) {
		if (
			lineText[index] !== "[" ||
			isEscaped(lineText, index) ||
			isImageMarker(lineText, index)
		) {
			continue;
		}

		const labelEnd = findClosingBracket(lineText, index);
		if (labelEnd === -1 || lineText[labelEnd + 1] !== "(") {
			continue;
		}

		const destinationStart = labelEnd + 2;
		const destinationEnd = findInlineDestinationEnd(lineText, destinationStart);
		if (destinationEnd === -1) {
			continue;
		}

		const destination = parseInlineDestination(
			lineText.slice(destinationStart, destinationEnd),
		);
		const normalizedDestination = destination
			? normalizeUrlToken(destination)
			: null;

		if (normalizedDestination && isExternalUrl(normalizedDestination)) {
			links.push({
				fullFrom: lineStart + index,
				fullTo: lineStart + destinationEnd + 1,
				labelFrom: lineStart + index + 1,
				labelTo: lineStart + labelEnd,
				destination: normalizedDestination,
			});
		}

		index = destinationEnd;
	}

	return links;
}

function getExternalUrlInRange(view: EditorView, from: number, to: number): string | null {
	let foundUrl: string | null = null;

	syntaxTree(view.state).iterate({
		from,
		to,
		enter: (node) => {
			if (foundUrl) {
				return false;
			}

			if (!isUrlNode(node.name)) {
				return;
			}

			const candidate = normalizeUrlToken(
				view.state.doc.sliceString(node.from, node.to),
			);

			if (isExternalUrl(candidate)) {
				foundUrl = candidate;
				return false;
			}

			return;
		},
	});

	return foundUrl;
}

function getSyntaxNodePath(view: EditorView, pos: number): string[] {
	const tree = syntaxTree(view.state);
	const path: string[] = [];
	let node: typeof tree.topNode | null = tree.resolveInner(pos, -1);

	while (node && path.length < 12) {
		path.push(`${node.name}[${node.from}-${node.to}]`);
		node = node.parent;
	}

	return path;
}

function isPotentialLinkNode(name: string): boolean {
	const normalizedName = name.toLowerCase();
	return normalizedName.includes("link") || normalizedName.includes("url");
}

function isUrlNode(name: string): boolean {
	const normalizedName = name.toLowerCase();
	return normalizedName === "url" || normalizedName.includes("url");
}

function extractExternalUrl(markdown: string): string | null {
	const directUrl = normalizeUrlToken(markdown);
	if (isExternalUrl(directUrl)) {
		return directUrl;
	}

	const inlineDestination = extractInlineLinkDestination(markdown);
	if (!inlineDestination) {
		return null;
	}

	const normalizedDestination = normalizeUrlToken(inlineDestination);
	return isExternalUrl(normalizedDestination) ? normalizedDestination : null;
}

function extractInlineLinkDestination(markdown: string): string | null {
	const destinationStart = findInlineDestinationStart(markdown);
	if (destinationStart === -1) {
		return null;
	}

	const destinationEnd = findInlineDestinationEnd(markdown, destinationStart);
	if (destinationEnd === -1) {
		return null;
	}

	return parseInlineDestination(markdown.slice(destinationStart, destinationEnd));
}

function parseInlineDestination(text: string): string | null {
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

function findClosingBracket(text: string, start: number): number {
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

function isImageMarker(text: string, bracketIndex: number): boolean {
	return bracketIndex > 0 && text[bracketIndex - 1] === "!" && !isEscaped(text, bracketIndex - 1);
}

function isInRange(value: number, from: number, to: number): boolean {
	return value >= from && value <= to;
}

function rangesOverlap(firstFrom: number, firstTo: number, secondFrom: number, secondTo: number): boolean {
	return firstFrom <= secondTo && secondFrom <= firstTo;
}

function findInlineDestinationStart(markdown: string): number {
	for (let index = 0; index < markdown.length - 1; index += 1) {
		if (
			markdown[index] === "]" &&
			markdown[index + 1] === "(" &&
			!isEscaped(markdown, index)
		) {
			return index + 2;
		}
	}

	return -1;
}

function findInlineDestinationEnd(markdown: string, start: number): number {
	let depth = 0;

	for (let index = start; index < markdown.length; index += 1) {
		const char = markdown[index];

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

function findUnescaped(text: string, needle: string, start: number): number {
	for (let index = start; index < text.length; index += 1) {
		if (text[index] === needle && !isEscaped(text, index)) {
			return index;
		}
	}

	return -1;
}

function isEscaped(text: string, index: number): boolean {
	let slashCount = 0;
	for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
		slashCount += 1;
	}

	return slashCount % 2 === 1;
}

function normalizeUrlToken(text: string): string {
	let url = text.trim();

	if (url.startsWith("<") && url.endsWith(">")) {
		url = url.slice(1, -1).trim();
	}

	return url.replace(/\\([\\`*_[\]{}()#+\-.!<>])/g, "$1");
}

function isExternalUrl(url: string): boolean {
	// Explicit allowlist — avoids false positives from tokens like "c:\...",
	// "note:foo", or any other "word:" that matches a permissive scheme pattern.
	return /^(?:https?:\/\/|ftps?:\/\/|file:\/\/|mailto:[^\s]+|ssh:\/\/|git:\/\/|obsidian:\/\/|\/\/|www\.)/i.test(url);
}
