import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { syntaxTree } from "@codemirror/language";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

interface LinkTooltipSettings {
	showTooltip: boolean;
	debugLogging: boolean;
}

const DEFAULT_SETTINGS: LinkTooltipSettings = {
	showTooltip: false,
	debugLogging: false,
};

const LINK_SELECTOR = ".cm-link, .cm-url.external-link, .external-link";
const MAX_STATUS_URL_LENGTH = 60;

export default class LinkTooltipPlugin extends Plugin {
	settings: LinkTooltipSettings = { ...DEFAULT_SETTINGS };

	private statusBarItem: HTMLElement | null = null;
	private tooltipEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.addClass("link-tooltip-status");
		this.hideStatusUrl();

		this.addSettingTab(new LinkTooltipSettingTab(this.app, this));
		this.registerEditorExtension(createLinkTooltipExtension(this));
		this.debug("loaded", this.settings);
	}

	onunload(): void {
		this.clearDisplay();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	showUrl(url: string, event: MouseEvent): void {
		if (this.settings.showTooltip) {
			this.hideStatusUrl();
			this.showTooltip(url, event);
			return;
		}

		this.hideTooltip();
		this.showStatusUrl(url);
	}

	clearDisplay(): void {
		this.hideStatusUrl();
		this.hideTooltip();
	}

	debug(message: string, ...data: unknown[]): void {
		if (!this.settings.debugLogging) {
			return;
		}

		console.log(`[link-tooltip] ${message}`, ...data);
	}

	private showStatusUrl(url: string): void {
		if (!this.statusBarItem) {
			return;
		}

		this.statusBarItem.setText(truncateLeft(url, MAX_STATUS_URL_LENGTH));
		this.statusBarItem.setAttr("title", url);
		this.statusBarItem.style.display = "";
	}

	private hideStatusUrl(): void {
		if (!this.statusBarItem) {
			return;
		}

		this.statusBarItem.setText("");
		this.statusBarItem.removeAttribute("title");
		this.statusBarItem.style.display = "none";
	}

	private showTooltip(url: string, event: MouseEvent): void {
		const tooltip = this.getTooltipEl();
		tooltip.setText(url);
		tooltip.style.display = "block";

		const gap = 12;
		const edgePadding = 8;
		const rect = tooltip.getBoundingClientRect();
		let left = event.clientX + gap;
		let top = event.clientY + gap;

		if (left + rect.width > window.innerWidth - edgePadding) {
			left = window.innerWidth - rect.width - edgePadding;
		}

		if (top + rect.height > window.innerHeight - edgePadding) {
			top = event.clientY - rect.height - gap;
		}

		tooltip.style.left = `${Math.max(edgePadding, left)}px`;
		tooltip.style.top = `${Math.max(edgePadding, top)}px`;
	}

	private getTooltipEl(): HTMLElement {
		if (this.tooltipEl) {
			return this.tooltipEl;
		}

		this.tooltipEl = document.createElement("div");
		this.tooltipEl.addClass("link-tooltip-floating");
		document.body.appendChild(this.tooltipEl);
		return this.tooltipEl;
	}

	private hideTooltip(): void {
		this.tooltipEl?.remove();
		this.tooltipEl = null;
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
			.setName("Show floating tooltip")
			.setDesc("When disabled, hovered external link URLs are shown in the status bar.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showTooltip)
					.onChange(async (value) => {
						this.plugin.settings.showTooltip = value;
						this.plugin.clearDisplay();
						await this.plugin.saveSettings();
					});
			});

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
	return ViewPlugin.fromClass(
		class LinkTooltipViewPlugin {
			private lastDebugKey: string | null = null;

			private readonly onMouseMove = (event: MouseEvent): void => {
				const target = event.target;
				if (!(target instanceof Element) || !target.closest(LINK_SELECTOR)) {
					this.clear();
					return;
				}

				const pos = this.view.posAtCoords({
					x: event.clientX,
					y: event.clientY,
				});

				if (pos === null) {
					this.clear();
					return;
				}

				const url = getExternalUrlAt(this.view, pos);
				this.debugHover(target, pos, url);
				if (!url) {
					this.clear();
					return;
				}

				plugin.showUrl(url, event);
			};

			private readonly onMouseOut = (event: MouseEvent): void => {
				const target = event.target;
				if (!(target instanceof Element)) {
					return;
				}

				const linkEl = target.closest(LINK_SELECTOR);
				if (!linkEl) {
					return;
				}

				const relatedTarget = event.relatedTarget;
				if (relatedTarget instanceof Node && linkEl.contains(relatedTarget)) {
					return;
				}

				this.clear();
			};

			constructor(private readonly view: EditorView) {
				this.view.dom.addEventListener("mousemove", this.onMouseMove);
				this.view.dom.addEventListener("mouseout", this.onMouseOut);
				this.view.dom.addEventListener("mouseleave", this.clear);
				plugin.debug("editor extension attached", {
					docLength: this.view.state.doc.length,
				});
			}

			update(update: ViewUpdate): void {
				if (update.docChanged || update.viewportChanged) {
					this.clear();
				}
			}

			destroy(): void {
				this.view.dom.removeEventListener("mousemove", this.onMouseMove);
				this.view.dom.removeEventListener("mouseout", this.onMouseOut);
				this.view.dom.removeEventListener("mouseleave", this.clear);
				this.clear();
			}

			private readonly clear = (): void => {
				plugin.clearDisplay();
			};

			private debugHover(target: Element, pos: number, url: string | null): void {
				if (!plugin.settings.debugLogging) {
					return;
				}

				const nodePath = getSyntaxNodePath(this.view, pos);
				const debugKey = `${describeElement(target)}|${nodePath.join(">")}|${url ?? ""}`;
				if (this.lastDebugKey === debugKey) {
					return;
				}

				this.lastDebugKey = debugKey;
				plugin.debug("link hover", {
					target: describeElement(target),
					nodePath,
					url,
				});
			}
		},
	);
}

function getExternalUrlAt(view: EditorView, pos: number): string | null {
	const tree = syntaxTree(view.state);
	let node: typeof tree.topNode | null = tree.resolveInner(pos, -1);
	let linkRange: { from: number; to: number } | null = null;

	while (node) {
		if (isUrlNode(node.name)) {
			const candidate = normalizeUrlToken(
				view.state.doc.sliceString(node.from, node.to),
			);
			if (isExternalUrl(candidate)) {
				return candidate;
			}
		}

		if (isPotentialLinkNode(node.name)) {
			linkRange = { from: node.from, to: node.to };

			const urlFromNode = getExternalUrlInRange(view, node.from, node.to);
			if (urlFromNode) {
				return urlFromNode;
			}

			const urlFromLine = getExternalInlineUrlFromLine(
				view,
				pos,
				node.from,
				node.to,
			);
			if (urlFromLine) {
				return urlFromLine;
			}

			const nodeText = view.state.doc.sliceString(node.from, node.to);
			const parsedUrl = extractExternalUrl(nodeText);
			if (parsedUrl) {
				return parsedUrl;
			}
		}

		node = node.parent;
	}

	if (linkRange) {
		return getExternalInlineUrlFromLine(view, pos, linkRange.from, linkRange.to);
	}

	return getExternalInlineUrlFromLine(view, pos, pos, pos);
}

function getExternalInlineUrlFromLine(
	view: EditorView,
	pos: number,
	linkFrom: number,
	linkTo: number,
): string | null {
	const line = view.state.doc.lineAt(pos);
	const links = parseInlineLinks(line.text, line.from);

	for (const link of links) {
		if (
			isInRange(pos, link.fullFrom, link.fullTo) ||
			rangesOverlap(linkFrom, linkTo, link.labelFrom, link.labelTo)
		) {
			return link.destination;
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

function describeElement(element: Element): string {
	const className = Array.from(element.classList).join(".");
	return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
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
	return /^(?:(?:https?|ftp|ftps|file):\/\/|mailto:[^\s]+|[a-z][a-z\d+.-]*:[^\s]+|\/\/|www\.)/i.test(url);
}

function truncateLeft(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `…${text.slice(-(maxLength - 1))}`;
}
