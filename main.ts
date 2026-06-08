import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { destinationToShow, parseLinks } from "./links.mjs";

interface LinkTooltipSettings {
	externalLinks: boolean;
	internalLinks: boolean;
	debugLogging: boolean;
}

const DEFAULT_SETTINGS: LinkTooltipSettings = {
	externalLinks: true,
	internalLinks: true,
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

			if (plugin.settings.debugLogging) {
				plugin.debug("link hover", { pos, link });
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

function getLinkTooltipAt(
	view: EditorView,
	pos: number,
	settings: LinkTooltipSettings,
): LinkTooltipTarget | null {
	const line = view.state.doc.lineAt(pos);

	for (const link of parseLinks(line.text, line.from)) {
		if (pos < link.from || pos > link.to) {
			continue;
		}

		const url = destinationToShow(link);
		if (!url) {
			return null;
		}

		const enabled =
			link.kind === "external" ? settings.externalLinks : settings.internalLinks;
		return enabled ? { url, from: link.from, to: link.to } : null;
	}

	return null;
}
