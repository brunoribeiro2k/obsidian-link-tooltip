import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	SliderComponent,
	TextComponent,
} from "obsidian";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isExternalUrl } from "./url.mjs";

interface LinkTooltipSettings {
	externalLinks: boolean;
	internalLinks: boolean;
	hoverDelay: number;
	debugLogging: boolean;
}

const DEFAULT_SETTINGS: LinkTooltipSettings = {
	externalLinks: true,
	internalLinks: true,
	// Milliseconds the pointer must rest on a link before the tooltip shows.
	// Matches CodeMirror's own `hoverTime` default.
	hoverDelay: 300,
	debugLogging: false,
};

export default class LinkTooltipPlugin extends Plugin {
	settings: LinkTooltipSettings = { ...DEFAULT_SETTINGS };

	// A stable array reference handed to CodeMirror; we swap its contents and
	// call `updateOptions()` to apply settings that are baked in at extension
	// construction (e.g. the hover delay) without reloading the plugin.
	private readonly editorExtension: Extension[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new LinkTooltipSettingTab(this.app, this));
		this.editorExtension.push(createLinkTooltipExtension(this));
		this.registerEditorExtension(this.editorExtension);
	}

	// Rebuild the hover extension and push it live into open editors. Needed
	// because `hoverTime` is captured when `hoverTooltip` is created.
	reconfigureEditorExtension(): void {
		this.editorExtension.length = 0;
		this.editorExtension.push(createLinkTooltipExtension(this));
		this.app.workspace.updateOptions();
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<LinkTooltipSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
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
			.setName("Show tooltips for external links")
			.setDesc("Reveal the destination URL of a hovered external link.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.externalLinks)
					.onChange(async (value) => {
						this.plugin.settings.externalLinks = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Show tooltips for internal links")
			.setDesc(
				"Reveal the target of a hovered internal link or aliased wikilink.",
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.internalLinks)
					.onChange(async (value) => {
						this.plugin.settings.internalLinks = value;
						await this.plugin.saveSettings();
					});
			});

		// Slider and number box are two views of the same value; each updates the
		// other without re-firing onChange (Obsidian's setValue doesn't dispatch
		// an input event), so there's no feedback loop.
		let slider: SliderComponent;
		let text: TextComponent;

		const applyDelay = async (value: number) => {
			this.plugin.settings.hoverDelay = value;
			await this.plugin.saveSettings();
			this.plugin.reconfigureEditorExtension();
		};

		new Setting(containerEl)
			.setName("Tooltip delay")
			.setDesc(
				"Milliseconds to wait after hovering a link before the tooltip appears. Set to 0 to show it immediately.",
			)
			.addSlider((component) => {
				slider = component;
				// `setInstant` (Obsidian 1.6.6+, our minAppVersion) makes onChange
				// fire while dragging rather than only on release.
				component
					.setInstant(true)
					.setLimits(0, 1000, 50)
					.setValue(this.plugin.settings.hoverDelay)
					.onChange(async (value) => {
						text.setValue(String(value));
						await applyDelay(value);
					});
			})
			.addText((component) => {
				text = component;
				component.inputEl.type = "number";
				component.inputEl.min = "0";
				component.inputEl.max = "1000";
				component.inputEl.step = "50";
				component
					.setValue(String(this.plugin.settings.hoverDelay))
					.onChange(async (raw) => {
						if (raw.trim() === "") {
							return;
						}

						const parsed = Number(raw);
						if (Number.isNaN(parsed)) {
							return;
						}

						const value = Math.min(1000, Math.max(0, Math.round(parsed)));
						slider.setValue(value);
						if (String(value) !== raw) {
							component.setValue(String(value));
						}
						await applyDelay(value);
					});
			});

		new Setting(containerEl)
			.setName("Debug logging")
			.setDesc("Log hover diagnostics to the developer console.")
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

interface LinkTooltipTarget {
	url: string;
	from: number;
	to: number;
}

function createLinkTooltipExtension(plugin: LinkTooltipPlugin) {
	// Delegate the whole hover lifecycle — positioning, teardown, pop-out
	// window placement, hide-on-scroll — to CodeMirror's own tooltip system.
	return hoverTooltip(
		(view, pos) => {
			const link = getLinkTooltipAt(view, pos, plugin.settings);

			if (!link) {
				return null;
			}

			plugin.debug("link hover", { pos, link });

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
					return {
						dom,
						mount() {
							// CodeMirror wraps `dom` in its own .cm-tooltip
							// element. Tag that wrapper so styles.css can re-skin
							// only our tooltip without a :has() selector.
							dom.parentElement?.addClass("link-tooltip");
						},
					};
				},
			};
		},
		// CodeMirror reads `hoverTime` as `options.hoverTime || 300`, so a 0 here
		// would silently revert to 300ms. Map 0 (the "show immediately" setting)
		// to 1ms so it stays effectively instant.
		{ hideOnChange: true, hoverTime: plugin.settings.hoverDelay || 1 },
	);
}

// Obsidian renders the editor as a flat stream of HyperMD style tokens rather
// than a structured Link/URL tree (see #33). Detection therefore walks the leaf
// tokens of the hovered line, classifies them by their underscore-joined style
// classes, and reassembles the single link under the cursor. The tokenizer has
// already resolved code spans/blocks, escapes, and angle-bracket destinations,
// so the gnarly cases the old line parser fought with come for free.

interface LeafToken {
	name: string;
	from: number;
	to: number;
}

type LinkFamily = "md" | "wiki";

function classesOf(name: string): string[] {
	return name.split("_");
}

// Inline code and code blocks both carry a "*code*" class (inline-code,
// hmd-codeblock, HyperMD-codeblock-bg); nothing link-related contains "code".
function isCodeToken(name: string): boolean {
	return /code/i.test(name);
}

function linkFamily(name: string): LinkFamily | null {
	if (isCodeToken(name)) {
		return null;
	}

	const cls = classesOf(name);
	if (
		cls.includes("hmd-internal-link") ||
		cls.includes("formatting-link-start") ||
		cls.includes("formatting-link-end")
	) {
		return "wiki";
	}
	if (cls.includes("url") || cls.includes("link")) {
		return "md";
	}

	return null;
}

// Within a Markdown link, the label/brackets carry "link" and the destination
// and its parens carry "url".
function markdownRole(name: string): "label" | "url" | null {
	const cls = classesOf(name);
	if (cls.includes("url")) {
		return "url";
	}
	if (cls.includes("link")) {
		return "label";
	}

	return null;
}

function getLinkTooltipAt(
	view: EditorView,
	pos: number,
	settings: LinkTooltipSettings,
): LinkTooltipTarget | null {
	const tree = syntaxTree(view.state);
	const line = view.state.doc.lineAt(pos);

	const leaves: LeafToken[] = [];
	tree.iterate({
		from: line.from,
		to: line.to,
		enter(node) {
			if (!node.node.firstChild) {
				leaves.push({ name: node.name, from: node.from, to: node.to });
			}
		},
	});

	// Half-open match: a hover exactly at a link's exclusive end belongs to the
	// next token, so it shows nothing (#29).
	const index = leaves.findIndex((token) => pos >= token.from && pos < token.to);
	if (index === -1) {
		return null;
	}

	const family = linkFamily(leaves[index].name);
	if (family === "md") {
		return resolveMarkdownLink(view, leaves, index, settings);
	}
	if (family === "wiki") {
		return resolveWikilink(view, leaves, index, settings);
	}

	return null;
}

function resolveMarkdownLink(
	view: EditorView,
	leaves: LeafToken[],
	index: number,
	settings: LinkTooltipSettings,
): LinkTooltipTarget | null {
	// Segment the one link around `index`. Adjacent links touch only at a
	// url -> label transition (a closing `)` followed by the next `[`), so split
	// the contiguous "md" run there.
	let start = index;
	while (
		start > 0 &&
		linkFamily(leaves[start - 1].name) === "md" &&
		!(
			markdownRole(leaves[start].name) === "label" &&
			markdownRole(leaves[start - 1].name) === "url"
		)
	) {
		start -= 1;
	}

	let end = index;
	while (
		end < leaves.length - 1 &&
		linkFamily(leaves[end + 1].name) === "md" &&
		!(
			markdownRole(leaves[end].name) === "url" &&
			markdownRole(leaves[end + 1].name) === "label"
		)
	) {
		end += 1;
	}

	// The destination is the url *content* token (carries "url" but not the
	// "formatting" of the parens). A label must be present too, otherwise this is
	// a bare autolink, which already shows its destination.
	let destToken: LeafToken | null = null;
	let hasLabel = false;
	for (let i = start; i <= end; i += 1) {
		const cls = classesOf(leaves[i].name);
		if (cls.includes("url") && !cls.includes("formatting")) {
			destToken = leaves[i];
		}
		if (markdownRole(leaves[i].name) === "label") {
			hasLabel = true;
		}
	}
	if (!destToken || !hasLabel) {
		return null;
	}

	const destination = normalizeDestination(
		view.state.doc.sliceString(destToken.from, destToken.to),
	);
	if (!destination) {
		return null;
	}

	const kind = isExternalUrl(destination) ? "external" : "internal";
	const enabled =
		kind === "external" ? settings.externalLinks : settings.internalLinks;
	if (!enabled) {
		return null;
	}

	return { url: destination, from: leaves[start].from, to: leaves[end].to };
}

function resolveWikilink(
	view: EditorView,
	leaves: LeafToken[],
	index: number,
	settings: LinkTooltipSettings,
): LinkTooltipTarget | null {
	let start = index;
	while (start >= 0 && linkFamily(leaves[start].name) === "wiki") {
		if (classesOf(leaves[start].name).includes("formatting-link-start")) {
			break;
		}
		start -= 1;
	}
	if (
		start < 0 ||
		!classesOf(leaves[start].name).includes("formatting-link-start")
	) {
		return null;
	}

	let end = index;
	while (end < leaves.length && linkFamily(leaves[end].name) === "wiki") {
		if (classesOf(leaves[end].name).includes("formatting-link-end")) {
			break;
		}
		end += 1;
	}
	if (
		end >= leaves.length ||
		!classesOf(leaves[end].name).includes("formatting-link-end")
	) {
		return null;
	}

	// Only aliased wikilinks hide their destination; a bare [[Note]] already shows
	// it. The alias pipe is the marker.
	let pipe: LeafToken | null = null;
	for (let i = start; i <= end; i += 1) {
		if (classesOf(leaves[i].name).includes("link-alias-pipe")) {
			pipe = leaves[i];
			break;
		}
	}
	if (!pipe) {
		return null;
	}

	if (!settings.internalLinks) {
		return null;
	}

	const destination = view.state.doc.sliceString(leaves[start].to, pipe.from).trim();
	if (!destination) {
		return null;
	}

	return { url: destination, from: leaves[start].from, to: leaves[end].to };
}

function normalizeDestination(text: string): string {
	let url = text.trim();

	if (url.startsWith("<") && url.endsWith(">")) {
		url = url.slice(1, -1).trim();
	}

	return url.replace(/\\([\\`*_[\]{}()#+\-.!<>])/g, "$1");
}
