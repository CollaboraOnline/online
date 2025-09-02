/* eslint-disable */
/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global _ */

interface StringConstructor {
	defaultLocale: string;
	locale: string;
}
var _: any = (s) => s.toLocaleString();

interface Window {
	accessToken?: string;
	accessTokenTTL?: string;
	enableAccessibility?: boolean;
	enableDebug?: boolean;
	wopiSettingBaseUrl?: string;
	iframeType?: string;
	cssVars?: string;
	serviceRoot?: string;
}

interface ConfigItem {
	stamp: string;
	uri: string;
}

interface ConfigData {
	kind: 'shared' | 'user';
	autotext: ConfigItem[] | null;
	wordbook: ConfigItem[] | null;
	browsersetting: ConfigItem[] | null;
	viewsetting: ConfigItem[] | null;
	xcu: ConfigItem[] | null;
}

interface SectionConfig {
	sectionTitle: string;
	sectionDesc: string;
	listId: string;
	inputId: string;
	buttonId: string;
	fileAccept: string;
	buttonText: string;
	uploadPath: string;
	enabledFor?: string;
	debugOnly?: boolean;
}

const initTranslationStr = () => {
	const element = document.getElementById('initial-variables');
	document.documentElement.lang =
		(element as HTMLInputElement).dataset.lang || 'en-US';

	String.defaultLocale = 'en-US';
	String.locale =
		document.documentElement.getAttribute('lang') || String.defaultLocale;
};

const defaultBrowserSetting: Record<string, any> = {
	compactMode: {
		value: false,
		label: 'Compact layout',
		customType: 'compactToggle',
	},
	darkTheme: false,
	spreadsheet: {
		ShowStatusbar: false,
		A11yCheckDeck: false,
		NavigatorDeck: false,
		PropertyDeck: true,
	},
	text: {
		ShowRuler: false,
		ShowStatusbar: false,
		A11yCheckDeck: false,
		NavigatorDeck: false,
		PropertyDeck: true,
		StyleListDeck: false,
	},
	presentation: {
		ShowRuler: false,
		ShowStatusbar: false,
		A11yCheckDeck: false,
		NavigatorDeck: false,
		PropertyDeck: true,
		SdCustomAnimationDeck: false,
		SdMasterPagesDeck: false,
		SdSlideTransitionDeck: false,
	},
	drawing: {
		ShowRuler: false,
		ShowStatusbar: false,
		A11yCheckDeck: false,
		NavigatorDeck: false,
		PropertyDeck: true,
	},
};

class SettingIframe {
	private wordbook;
	private xcuEditor;
	private _viewSetting;
	private _viewSettingLabels = {
		accessibilityState: _('Accessibility'),
		zoteroAPIKey: 'Zotero',
	};
	private readonly settingLabels: Record<string, string> = {
		darkTheme: _('Dark mode'),
		compactMode: _('Compact layout'),
		ShowStatusbar: _('Show status bar'),
		ShowRuler: _('Show ruler'),
		A11yCheckDeck: _('Accessibility Checker'),
		NavigatorDeck: _('Navigator'),
		PropertyDeck: _('Show Sidebar'),
		SdCustomAnimationDeck: _('Custom Animation'),
		SdMasterPagesDeck: _('Master Pages'),
		SdSlideTransitionDeck: _('Slide Transition'),
		StyleListDeck: _('Style List'),
		// Add more as needed
	};

	// SVG templates for icons that are small and always present (no async load needed)
	private readonly SVG_ICONS = {
		download: `<svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"></path></svg>`,
		delete: `<svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>`,
		edit: `<svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75l11-11.03-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>`,
		reset: `<svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.03.67-.08 1h2.02c.05-.33.06-.66.06-1 0-4.42-3.58-8-8-8zm-6 7c0-.34.03-.67.08-1H4.06c-.05.33-.06.66-.06 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6z"></path></svg>`,
		checkboxMarked: `<svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24"><path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z"></path></svg>`,
		checkboxBlankOutline: `<svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24"><path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"></path></svg>`,
	};

	private getAPIEndpoints() {
		return {
			uploadSettings: window.serviceRoot + '/browser/dist/upload-settings',

			fetchSharedConfig:
				window.serviceRoot + '/browser/dist/fetch-settings-config',

			deleteSharedConfig:
				window.serviceRoot + '/browser/dist/delete-settings-config',

			fetchSettingFile:
				window.serviceRoot + '/browser/dist/fetch-settings-file',
		};
	}

	private PATH = {
		autoTextUpload: () => this.settingConfigBasePath() + '/autotext/',
		wordBookUpload: () => this.settingConfigBasePath() + '/wordbook/',
		browserSettingsUpload: () =>
			this.settingConfigBasePath() + '/browsersetting/',
		viewSettingsUpload: () => this.settingConfigBasePath() + '/viewsetting/',
		XcuUpload: () => this.settingConfigBasePath() + '/xcu/',
	};
	private browserSettingOptions: Record<string, any> = {};

	init(): void {
		this.initWindowVariables();
		this.insertConfigSections();
		void this.fetchAndPopulateSharedConfigs();
		this.wordbook = (window as any).WordBook;
	}

	public async uploadXcuFile(filename: string, content: string): Promise<void> {
		const file = new File([content], filename, { type: 'application/xml' });
		await this.uploadFile(this.PATH.XcuUpload(), file);
	}

	async uploadWordbookFile(filename: string, content: string): Promise<void> {
		const file = new File([content], filename, { type: 'text/plain' });
		await this.uploadFile(this.PATH.wordBookUpload(), file);
	}

	async uploadViewSettingFile(
		filename: string,
		content: string,
	): Promise<void> {
		const file = new File([content], filename, { type: 'text/plain' });
		await this.uploadFile(this.PATH.viewSettingsUpload(), file);
	}

	private initWindowVariables(): void {
		const element = document.getElementById('initial-variables');
		if (!element) return;

		window.accessToken = element.dataset.accessToken;
		window.accessTokenTTL = element.dataset.accessTokenTtl;
		window.enableDebug = element.dataset.enableDebug === 'true';
		window.enableAccessibility = element.dataset.enableAccessibility === 'true';
		window.wopiSettingBaseUrl = element.dataset.wopiSettingBaseUrl;
		window.iframeType = element.dataset.iframeType;
		window.cssVars = element.dataset.cssVars;
		if (window.cssVars) {
			window.cssVars = atob(window.cssVars);
			const sheet = new CSSStyleSheet();
			if (typeof (sheet as any).replace === 'function') {
				(sheet as any).replace(window.cssVars);
				(document as any).adoptedStyleSheets.push(sheet);
			}
		}
		window.serviceRoot = element.dataset.serviceRoot;
	}

	private validateJsonFile(file: File): Promise<any> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const content = event.target?.result as string;
					const jsonData = JSON.parse(content);
					resolve(jsonData);
				} catch (error) {
					reject(new Error(_('Invalid JSON file')));
				}
			};
			reader.onerror = () => {
				reject(new Error(_('Error reading file')));
			};
			reader.readAsText(file);
		});
	}

	private insertConfigSections(): void {
		const sharedConfigsContainer = document.getElementById('allConfigSection');
		if (!sharedConfigsContainer) return;

		const configSections: SectionConfig[] = [
			{
				sectionTitle: _('Autotext'),
				sectionDesc: _(
					'Upload reusable text snippets (.bau). To insert the text in your document, type the shortcut for an AutoText entry and press F3.',
				),
				listId: 'autotextList',
				inputId: 'autotextFile',
				buttonId: 'uploadAutotextButton',
				fileAccept: '.bau',
				buttonText: _('Upload Autotext'),
				uploadPath: this.PATH.autoTextUpload(),
			},
			{
				sectionTitle: _('Custom dictionaries'),
				sectionDesc: _(
					'Add or edit words in a spell check dictionary. Words in your wordbook (.dic) will be available for spelling checks.',
				),
				listId: 'wordbookList',
				inputId: 'wordbookFile',
				buttonId: 'uploadWordbookButton',
				fileAccept: '.dic',
				buttonText: _('Upload Wordbook'),
				uploadPath: this.PATH.wordBookUpload(),
			},
			{
				sectionTitle: _('Document settings'),
				sectionDesc: _('Adjust how office documents behave.'),
				listId: 'XcuList',
				inputId: 'XcuFile',
				buttonId: 'uploadXcuButton',
				fileAccept: '.xcu',
				// TODO: replace btn with rich interface (toggles)
				buttonText: _('Upload Xcu'),
				uploadPath: this.PATH.XcuUpload(),
				debugOnly: true,
			},
		];

		configSections.forEach((cfg) => {
			if (cfg.enabledFor && cfg.enabledFor !== this.getConfigType()) {
				return;
			}

			if (cfg.debugOnly && !window.enableDebug) {
				return;
			}

			const sectionEl = this.createConfigSection(cfg);
			const fileInput = sectionEl.querySelector<HTMLInputElement>(
				`#${cfg.inputId}`,
			);
			const button = sectionEl.querySelector<HTMLButtonElement>(
				`#${cfg.buttonId}`,
			);

			if (fileInput && button) {
				button.addEventListener('click', () => {
					fileInput.click();
				});

				fileInput.addEventListener('change', async () => {
					if (fileInput.files?.length) {
						if (cfg.uploadPath === this.PATH.wordBookUpload()) {
							this.wordbook.wordbookValidation(
								cfg.uploadPath,
								fileInput.files[0],
							);
						} else {
							let file = fileInput.files[0];

							this.uploadFile(cfg.uploadPath, file);
						}
						fileInput.value = '';
					}
				});
			}

			sharedConfigsContainer.appendChild(sectionEl);
		});
	}

	private async fetchAndPopulateSharedConfigs(): Promise<void> {
		if (!window.wopiSettingBaseUrl) {
			console.error(_('Shared Config URL is missing in initial variables.'));
			return;
		}
		console.debug('iframeType page', window.iframeType);

		if (!window.accessToken) {
			console.error(_('Access token is missing in initial variables.'));
			return;
		}

		const formData = new FormData();
		formData.append('sharedConfigUrl', window.wopiSettingBaseUrl);
		formData.append('accessToken', window.accessToken);
		formData.append('type', this.getConfigType());

		try {
			const response: Response = await fetch(
				this.getAPIEndpoints().fetchSharedConfig,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${window.accessToken}`,
					},
					body: formData,
				},
			);

			if (!response.ok) {
				console.error(
					'something wend wrong shared config response',
					response.text(),
				);
				throw new Error(
					`Could not fetch shared config: ${response.statusText}`,
				);
			}

			const data: ConfigData = await response.json();
			await this.populateSharedConfigUI(data);
			console.debug('Shared config data: ', data);
		} catch (error: unknown) {
			SettingIframe.showErrorModal(
				_('Something went wrong. Please try to refresh the page.'),
			);
			console.error('Error fetching shared config:', error);
		}
	}

	private createConfigSection(config: SectionConfig): HTMLDivElement {
		const sectionEl = document.createElement('div');
		sectionEl.classList.add('section');

		sectionEl.appendChild(this.createHeading(config.sectionTitle, 'h3'));
		sectionEl.appendChild(this.createParagraph(config.sectionDesc));
		sectionEl.appendChild(this.createUnorderedList(config.listId));
		sectionEl.appendChild(
			this.createFileInput(config.inputId, config.fileAccept),
		);
		sectionEl.appendChild(
			this.createButton(config.buttonId, config.buttonText),
		);

		return sectionEl;
	}

	private createHeading(text: string, level: 'h1' | 'h2' | 'h3' = 'h3') {
		const headingEl = document.createElement(level);
		headingEl.textContent = text;
		return headingEl;
	}

	private createParagraph(text: string) {
		const pEl = document.createElement('p');
		pEl.textContent = text;
		return pEl;
	}

	private createUnorderedList(id: string) {
		const ulEl = document.createElement('ul');
		ulEl.id = id;
		return ulEl;
	}

	private createFileInput(id: string, accept: string) {
		const inputEl = document.createElement('input');
		inputEl.type = 'file';
		inputEl.classList.add('hidden');
		inputEl.id = id;
		inputEl.accept = accept;
		return inputEl;
	}

	private createTextInput(
		id: string,
		placeholder: string = '',
		text: string = '',
		onChangeHandler = (input) => {},
	) {
		const inputEl = document.createElement('input');
		inputEl.type = 'text';
		inputEl.id = id;
		inputEl.value = text;
		inputEl.placeholder = placeholder;
		inputEl.classList.add('dic-input-container');

		inputEl.addEventListener('change', () => {
			onChangeHandler(inputEl);
		});
		return inputEl;
	}

	private createButton(id: string, text: string) {
		const buttonEl = document.createElement('button');
		buttonEl.id = id;
		buttonEl.type = 'button';
		buttonEl.classList.add(
			'inline-button',
			'button',
			'button--text-only',
			'button--vue-secondary',
		);

		const wrapperSpan = document.createElement('span');
		wrapperSpan.classList.add('button__wrapper');

		const textSpan = document.createElement('span');
		textSpan.classList.add('button__text');
		textSpan.textContent = text; // Safely set text content
		wrapperSpan.appendChild(textSpan);

		buttonEl.appendChild(wrapperSpan);

		return buttonEl;
	}

	private async fetchSettingFile(fileId: string) {
		try {
			const formData = new FormData();
			formData.append('fileUrl', fileId);
			formData.append('accessToken', window.accessToken ?? '');

			const apiUrl = this.getAPIEndpoints().fetchSettingFile;

			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${window.accessToken}`,
				},
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.statusText}`);
			}

			return await response.text();
		} catch (error) {
			SettingIframe.showErrorModal(
				_(
					'Something went wrong while fetching setting file. Please try to refresh the page.',
				),
			);
			return null;
		}
	}

	private async fetchWordbookFile(fileId: string): Promise<void> {
		this.wordbook.startLoader();
		try {
			const textValue = await this.fetchSettingFile(fileId);

			if (!textValue) {
				throw new Error('Failed to fetch wordbook file');
			}

			const wordbook = await this.wordbook.parseWordbookFileAsync(textValue);
			const fileName = this.getFilename(fileId, false);
			this.wordbook.stopLoader();
			this.wordbook.openWordbookEditor(fileName, wordbook);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Error uploading file: ${message}`);
			SettingIframe.showErrorModal(
				_(
					'Something went wrong while fetching wordbook. Please try to refresh the page.',
				),
			);
			this.wordbook.stopLoader();
		}
	}
	private createBrowserSettingForm(sharedConfigsContainer: HTMLElement): void {
		const editorContainer = document.createElement('div');
		editorContainer.id = 'browser-setting';
		editorContainer.className = 'section';
		editorContainer.appendChild(this.createHeading(_('Interface Settings')));
		editorContainer.appendChild(
			this.createParagraph(_('Set default interface preferences.')),
		);

		const navContainer = this.createBrowserSettingTabsNav(editorContainer);

		const commonTogglesData: Record<string, boolean> = {};

		for (const [key, value] of Object.entries(this.browserSettingOptions)) {
			// Include:
			// - plain booleans
			// - objects that have a customType (like compactToggle)
			if (
				typeof value === 'boolean' ||
				(typeof value === 'object' && value !== null && 'customType' in value)
			) {
				commonTogglesData[key] = value;
			}
		}

		if (Object.keys(commonTogglesData).length > 0) {
			const commonTogglesElement = this.renderSettingsOption(
				commonTogglesData,
				'common',
			);
			editorContainer.appendChild(commonTogglesElement);
			const separator = document.createElement('hr');
			separator.style.border = 'none';
			separator.style.borderTop = '1px solid var(--settings-border)';
			separator.style.marginTop = '1rem';
			editorContainer.appendChild(separator);
		}

		const contentsContainer = this.createBrowserSettingContentsContainer();
		const actionsContainer = this.createBrowserSettingActions(
			sharedConfigsContainer,
		);

		editorContainer.appendChild(navContainer);
		editorContainer.appendChild(contentsContainer);
		editorContainer.appendChild(actionsContainer);

		const oldEditor = sharedConfigsContainer.querySelector('#browser-setting');
		if (oldEditor && oldEditor.parentNode === sharedConfigsContainer) {
			sharedConfigsContainer.replaceChild(editorContainer, oldEditor);
		} else {
			sharedConfigsContainer.appendChild(editorContainer);
		}

		setTimeout(() => {
			const defaultTab = navContainer.querySelector(
				'#bs-tab-spreadsheet',
			) as HTMLElement;
			if (defaultTab) {
				defaultTab.click();
			}
		}, 0);
	}

	private createBrowserSettingTabsNav(
		editorContainer: HTMLElement,
	): HTMLDivElement {
		const navContainer = document.createElement('div');
		navContainer.className = 'browser-setting-tabs-nav';

		const tabs = [
			{ id: 'spreadsheet', label: 'Calc' },
			{ id: 'text', label: 'Writer' },
			{ id: 'presentation', label: 'Impress' },
			{ id: 'drawing', label: 'Draw' },
		];

		tabs.forEach((tab) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = `browser-setting-tab`;
			btn.id = `bs-tab-${tab.id}`;
			btn.textContent = _(tab.label);
			btn.addEventListener('click', () => {
				navContainer
					.querySelectorAll('.browser-setting-tab')
					.forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');

				const contentsContainer = editorContainer.querySelector(
					'#tab-contents-browserSetting',
				) as HTMLElement;
				contentsContainer.innerHTML = '';
				if (this.browserSettingOptions && this.browserSettingOptions[tab.id]) {
					const renderedTree = this.renderSettingsOption(
						this.browserSettingOptions[tab.id],
						tab.id,
					);
					renderedTree.classList.add('browser-settings-grid');
					contentsContainer.appendChild(renderedTree);
				} else {
					contentsContainer.textContent = _(
						`No settings available for ${tab.label}`,
					);
				}
			});
			navContainer.appendChild(btn);
		});
		return navContainer;
	}

	private createBrowserSettingContentsContainer(): HTMLDivElement {
		const contentsContainer = document.createElement('div');
		contentsContainer.id = 'tab-contents-browserSetting';
		contentsContainer.textContent = _('Select a tab to browser settings.');
		return contentsContainer;
	}

	private createBrowserSettingActions(
		sharedConfigsContainer: HTMLElement,
	): HTMLDivElement {
		const actionsContainer = document.createElement('div');
		actionsContainer.classList.add('browser-settings-editor-actions');

		const resetButton = this.createButtonWithIcon(
			'browser-settings-reset-button',
			'reset', // Use icon key
			_('Reset to default Document settings'),
			['button--vue-secondary', 'xcu-reset-icon'],
			async (button) => {
				const confirmed = window.confirm(
					_('Are you sure you want to reset Document settings?'),
				);
				if (!confirmed) {
					return;
				}
				this.browserSettingOptions = JSON.parse(
					JSON.stringify(defaultBrowserSetting),
				);
				this.createBrowserSettingForm(sharedConfigsContainer);
			},
			true, // icon-only
		);
		actionsContainer.appendChild(resetButton);

		const saveButton = this.createButtonWithText(
			'browser-settings-save-button',
			_('Save'),
			_('Save Document settings'),
			['button-primary'],
			async (button) => {
				button.disabled = true;
				this.collectBrowserSettingsFromUI(
					sharedConfigsContainer.querySelector('#browser-setting')!,
				);

				const file = new File(
					[JSON.stringify(this.browserSettingOptions)],
					'browsersetting.json',
					{
						type: 'application/json',
						lastModified: Date.now(),
					},
				);

				await this.uploadFile(this.PATH.browserSettingsUpload(), file);
				button.disabled = false;
			},
		);
		actionsContainer.appendChild(saveButton);

		return actionsContainer;
	}

	private createMaterialDesignIconContainer(
		iconSvgString: string,
	): HTMLSpanElement {
		const materialIconContainer = document.createElement('span');
		materialIconContainer.setAttribute('aria-hidden', 'true');
		materialIconContainer.setAttribute('role', 'img'); // Add role for accessibility where appropriate
		materialIconContainer.classList.add('material-design-icon');
		materialIconContainer.innerHTML = iconSvgString; // Safe as it's from trusted SVG_ICONS

		return materialIconContainer;
	}
	private createButtonWithIcon(
		id: string,
		iconKey: keyof typeof this.SVG_ICONS, // Use a type-safe key
		title: string,
		classes: string[],
		onClickHandler: (button: HTMLButtonElement) => void,
		isIconOnly: boolean = false,
	): HTMLButtonElement {
		const buttonEl = document.createElement('button');
		if (id) {
			buttonEl.id = id;
		}
		buttonEl.type = 'button';
		buttonEl.classList.add('button', ...classes);
		if (isIconOnly) {
			buttonEl.classList.add('button--icon-only');
		} else {
			buttonEl.classList.add('button--text-only');
		}
		buttonEl.title = title;

		const wrapperSpan = document.createElement('span');
		wrapperSpan.classList.add('button__wrapper');
		buttonEl.appendChild(wrapperSpan);

		const iconSpan = document.createElement('span');
		iconSpan.setAttribute('aria-hidden', 'true');
		iconSpan.classList.add('button__icon');
		wrapperSpan.appendChild(iconSpan);

		// Now correctly creates the inner span and injects the SVG
		iconSpan.appendChild(
			this.createMaterialDesignIconContainer(this.SVG_ICONS[iconKey]),
		);

		if (!isIconOnly) {
			const textSpan = document.createElement('span');
			textSpan.classList.add('button__text');
			textSpan.textContent = title;
			wrapperSpan.appendChild(textSpan);
		}

		buttonEl.addEventListener('click', () => onClickHandler(buttonEl));
		return buttonEl;
	}

	private createButtonWithText(
		id: string,
		text: string,
		title: string,
		classes: string[],
		onClickHandler: (button: HTMLButtonElement) => void,
	): HTMLButtonElement {
		const buttonEl = document.createElement('button');
		if (id) {
			buttonEl.id = id;
		}
		buttonEl.type = 'button';
		buttonEl.classList.add('button', 'button--text-only', ...classes);
		buttonEl.title = title;

		const wrapperSpan = document.createElement('span');
		wrapperSpan.classList.add('button__wrapper');
		buttonEl.appendChild(wrapperSpan);

		const textSpan = document.createElement('span');
		textSpan.classList.add('button__text');
		textSpan.textContent = text;
		wrapperSpan.appendChild(textSpan);

		buttonEl.addEventListener('click', () => onClickHandler(buttonEl));
		return buttonEl;
	}

	public renderSettingsOption(data: any, pathPrefix: string = ''): HTMLElement {
		const container = document.createElement('div');
		if (typeof data !== 'object' || data === null) {
			container.textContent = String(data);
			return container;
		}
		for (const key in data) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				const value = data[key];
				const uniqueId = pathPrefix ? `${pathPrefix}-${key}` : key;
				if (
					typeof value === 'object' &&
					value?.customType &&
					this.customRenderers[value.customType]
				) {
					const customElement = this.customRenderers[value.customType](
						key,
						value,
						uniqueId,
					);
					container.appendChild(customElement);
					continue;
				}
				if (
					typeof value === 'object' &&
					value !== null &&
					!Array.isArray(value)
				) {
					container.appendChild(this.createFieldset(key, value, uniqueId));
				} else {
					container.appendChild(
						this.createCheckboxToggle(key, value, uniqueId, data),
					);
				}
			}
		}
		return container;
	}

	private createFieldset(
		key: string,
		value: any,
		uniqueId: string,
	): HTMLFieldSetElement {
		const fieldset = document.createElement('fieldset');
		fieldset.classList.add('xcu-settings-fieldset');
		const legend = document.createElement('legend');
		legend.textContent = _(this.settingLabels[key] || key);
		fieldset.appendChild(legend);
		const childContent = this.renderSettingsOption(value, uniqueId);
		fieldset.appendChild(childContent);
		return fieldset;
	}

	// Helper to create a checkbox input element.
	private createCheckboxInput(
		id: string,
		isChecked: boolean,
		isDisabled: boolean,
	): HTMLInputElement {
		const inputCheckbox = document.createElement('input');
		inputCheckbox.type = 'checkbox';
		inputCheckbox.className = 'checkbox-radio-switch-input';
		inputCheckbox.id = id + '-input';
		inputCheckbox.checked = isChecked;
		inputCheckbox.disabled = isDisabled;
		return inputCheckbox;
	}

	private createCheckbox(
		id: string,
		isChecked: boolean,
		labelText: string,
		onClickHandler: (
			checkboxInput: HTMLInputElement,
			checkboxWrapper: HTMLSpanElement,
			materialIconContainer: HTMLSpanElement, // This is the inner span holding the SVG
		) => void,
		isDisabled: boolean = false,
		warningText: string | null = null,
	): HTMLSpanElement {
		const checkboxWrapper = document.createElement('span');
		checkboxWrapper.className = `checkbox-radio-switch checkbox-radio-switch-checkbox ${isChecked ? '' : 'checkbox-radio-switch--checked'} checkbox-wrapper`;
		checkboxWrapper.id = id + '-container';

		// Use the new helper here
		const inputCheckbox = this.createCheckboxInput(id, isChecked, isDisabled);
		checkboxWrapper.appendChild(inputCheckbox);

		const checkboxContent = document.createElement('span');
		checkboxContent.className =
			'checkbox-content checkbox-content-checkbox checkbox-content--has-text checkbox-radio-switch__content';
		checkboxContent.id = id + '-content';
		checkboxWrapper.appendChild(checkboxContent);

		const checkboxContentIcon = document.createElement('span');
		checkboxContentIcon.className = `${isDisabled ? 'checkbox-content-icon-disabled' : 'checkbox-content-icon'} checkbox-content-icon checkbox-radio-switch__icon ${isChecked ? '' : 'checkbox-content-icon--checked'}`;
		checkboxContentIcon.ariaHidden = 'true';
		checkboxContent.appendChild(checkboxContentIcon);

		const materialIconContainer = this.createMaterialDesignIconContainer(
			isChecked
				? this.SVG_ICONS.checkboxMarked
				: this.SVG_ICONS.checkboxBlankOutline,
		);
		checkboxContentIcon.appendChild(materialIconContainer);

		const textElement = document.createElement('span');
		textElement.className =
			'checkbox-content__text checkbox-radio-switch__text';
		textElement.textContent = labelText;
		checkboxContent.appendChild(textElement);

		if (warningText) {
			const warningEl = document.createElement('span');
			warningEl.className = 'ui-state-error-text';
			warningEl.textContent = warningText;
			checkboxContent.appendChild(warningEl);
		}

		if (!isDisabled) {
			checkboxWrapper.addEventListener('click', () => {
				onClickHandler(inputCheckbox, checkboxWrapper, materialIconContainer);
			});
		} else {
			checkboxWrapper.classList.add('checkbox-radio-switch--disabled');
		}

		return checkboxWrapper;
	}

	private createCheckboxToggle(
		key: string,
		value: boolean,
		uniqueId: string,
		data: any,
	): HTMLSpanElement {
		const labelText = _(this.settingLabels[key] || key);

		return this.createCheckbox(
			uniqueId,
			value,
			labelText,
			(inputCheckbox, checkboxWrapper, materialIconContainer) => {
				const currentChecked = !inputCheckbox.checked;
				inputCheckbox.checked = currentChecked;
				checkboxWrapper.classList.toggle(
					'checkbox-radio-switch--checked',
					!currentChecked,
				);
				materialIconContainer.innerHTML = currentChecked
					? this.SVG_ICONS.checkboxMarked
					: this.SVG_ICONS.checkboxBlankOutline;
				data[key] = currentChecked;
			},
		);
	}

	private collectBrowserSettingsFromUI(
		browserSettingSection: HTMLElement,
	): void {
		const inputs = browserSettingSection.querySelectorAll<HTMLInputElement>(
			'input.checkbox-radio-switch-input',
		);

		inputs.forEach((input) => {
			// Expected ID: section-setting-input (e.g., "writer-ShowSidebar-input")
			const parts = input.id.split('-');
			if (parts.length !== 3 || parts[2] !== 'input') return;

			const [sectionRaw, settingKey] = parts;
			const value = input.checked;

			if (sectionRaw === 'common') {
				this.browserSettingOptions[settingKey] = value;
			} else {
				(this.browserSettingOptions[sectionRaw] as Record<string, boolean>)[
					settingKey
				] = value;
			}
		});
	}

	private customRenderers: Record<
		string,
		(key: string, value: any, uniqueId: string) => HTMLElement
	> = {
		compactToggle: this.renderCompactModeToggle.bind(this),
	};

	private renderCompactModeToggle(
		key: string,
		setting: any,
		uniqueId: string,
	): HTMLElement {
		const container = document.createElement('div');
		container.className = 'custom-compact-toggle';

		const inputCheckbox = document.createElement('input');
		inputCheckbox.type = 'checkbox';
		inputCheckbox.className = 'checkbox-radio-switch-input';
		inputCheckbox.id = uniqueId + '-input';
		inputCheckbox.checked = setting.value;
		inputCheckbox.style.display = 'none'; // hidden input for logic
		container.appendChild(inputCheckbox);

		const options = document.createElement('div');
		options.className = 'toggle-options';

		const select = (useCompact: boolean) => {
			inputCheckbox.checked = useCompact;
			setting.value = useCompact;
			notebookImage.classList.toggle('selected', !useCompact);
			compactImage.classList.toggle('selected', useCompact);
		};

		const notebookOption = this.createCompactToggleOption(
			'Notebookbar.svg',
			'Notebookbar',
			_('Notebookbar view'),
			!setting.value,
			() => select(false),
		);
		const compactOption = this.createCompactToggleOption(
			'Compact.svg',
			'Compact',
			_('Compact view'),
			setting.value,
			() => select(true),
		);

		const notebookImage = notebookOption.querySelector(
			'.toggle-image',
		) as HTMLImageElement;
		const compactImage = compactOption.querySelector(
			'.toggle-image',
		) as HTMLImageElement;

		options.appendChild(notebookOption);
		options.appendChild(compactOption);
		container.appendChild(options);

		return container;
	}

	private createCompactToggleOption(
		imageSrc: string,
		imageAlt: string,
		labelText: string,
		isSelected: boolean,
		onClick: () => void,
	): HTMLDivElement {
		const optionDiv = document.createElement('div');
		optionDiv.className = 'toggle-option';

		const image = document.createElement('img');
		image.src = `images/${imageSrc}`;
		image.alt = imageAlt;
		image.className = `toggle-image ${isSelected ? 'selected' : ''}`;
		optionDiv.appendChild(image);

		const label = document.createElement('div');
		label.textContent = labelText;
		label.className = 'toggle-image-label';
		optionDiv.appendChild(label);

		image.addEventListener('click', onClick);

		return optionDiv;
	}

	private async uploadFile(filePath: string, file: File): Promise<void> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('filePath', filePath);
		if (window.wopiSettingBaseUrl) {
			formData.append('wopiSettingBaseUrl', window.wopiSettingBaseUrl);
		}

		try {
			const apiUrl = this.getAPIEndpoints().uploadSettings;

			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${window.accessToken}`,
				},
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.statusText}`);
			}

			await this.fetchAndPopulateSharedConfigs();
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Error uploading file: ${message}`);
			SettingIframe.showErrorModal(
				_('Something went wrong while uploading the file. Please try again.'),
			);
		}
	}

	private populateList(
		listId: string,
		items: ConfigItem[],
		category: string,
	): void {
		const listEl = document.getElementById(listId);
		if (!listEl) return;

		listEl.innerHTML = '';

		items.forEach((item) => {
			const fileName = this.getFilename(item.uri, false);
			const li = document.createElement('li');
			li.classList.add('list-item__wrapper');

			const listItemDiv = document.createElement('div');
			listItemDiv.classList.add('list-item');

			listItemDiv.appendChild(this.createListItemAnchor(fileName));
			listItemDiv.appendChild(
				this.createListItemActions(item, category, fileName),
			);

			li.appendChild(listItemDiv);
			listEl.appendChild(li);
		});
	}

	private createListItemAnchor(fileName: string): HTMLDivElement {
		const anchor = document.createElement('div');
		anchor.classList.add('list-item__anchor');

		const listItemContentDiv = document.createElement('div');
		listItemContentDiv.classList.add('list-item-content');

		const listItemContentMainDiv = document.createElement('div');
		listItemContentMainDiv.classList.add('list-item-content__main');

		const listItemContentNameDiv = document.createElement('div');
		listItemContentNameDiv.classList.add('list-item-content__name');
		listItemContentNameDiv.textContent = fileName;

		listItemContentMainDiv.appendChild(listItemContentNameDiv);
		listItemContentDiv.appendChild(listItemContentMainDiv);
		anchor.appendChild(listItemContentDiv);

		return anchor;
	}

	private createListItemActions(
		item: ConfigItem,
		category: string,
		fileName: string,
	): HTMLDivElement {
		const extraActionsDiv = document.createElement('div');
		extraActionsDiv.classList.add('list-item-content__extra-actions');

		extraActionsDiv.appendChild(
			this.createButtonWithIcon(
				'', // No specific ID needed for list item buttons
				'download', // Use icon key
				item.uri, // Use URI as title for download link
				['button--vue-secondary', 'download-icon'],
				(button) => window.open(item.uri, '_blank'),
				true,
			),
		);
		extraActionsDiv.appendChild(
			this.createButtonWithIcon(
				'',
				'delete', // Use icon key
				_('Delete'),
				['button--vue-secondary', 'delete-icon'],
				async (button) => {
					try {
						if (!window.accessToken) {
							throw new Error('Access token is missing.');
						}
						if (!window.wopiSettingBaseUrl) {
							throw new Error('wopiSettingBaseUrl is missing.');
						}

						const fileId =
							this.settingConfigBasePath() + category + '/' + fileName;

						const formData = new FormData();
						formData.append('fileId', fileId);
						formData.append('sharedConfigUrl', window.wopiSettingBaseUrl);
						formData.append('accessToken', window.accessToken);

						const response = await fetch(
							this.getAPIEndpoints().deleteSharedConfig,
							{
								method: 'POST',
								headers: {
									Authorization: `Bearer ${window.accessToken}`,
								},
								body: formData,
							},
						);

						if (!response.ok) {
							throw new Error(`Delete failed: ${response.statusText}`);
						}

						await this.fetchAndPopulateSharedConfigs();
					} catch (error: unknown) {
						SettingIframe.showErrorModal(
							_(
								'Something went wrong while deleting the file. Please try refreshing the page.',
							),
						);
						console.error('Error deleting file:', error);
					}
				},
				true,
			),
		);

		if (category === '/wordbook') {
			extraActionsDiv.appendChild(
				this.createButtonWithIcon(
					'',
					'edit', // Use icon key
					_('Edit'),
					['button--vue-secondary', 'edit-icon'],
					async () => await this.fetchWordbookFile(item.uri),
					true,
				),
			);
		}
		return extraActionsDiv;
	}

	private generateViewSettingUI(data: any) {
		this._viewSetting = data;
		const settingsContainer = document.getElementById('allConfigSection');
		if (!settingsContainer) {
			return;
		}

		let viewContainer = document.getElementById('view-section');
		if (viewContainer) {
			viewContainer.remove();
		}

		viewContainer = document.createElement('div');
		viewContainer.id = 'view-section';
		viewContainer.classList.add('section');

		viewContainer.appendChild(this.createHeading(_('View Settings')));
		viewContainer.appendChild(this.createParagraph(_('Adjust view settings.')));

		const divContainer = document.createElement('div');
		divContainer.id = 'view-editor';
		viewContainer.appendChild(divContainer);

		const fieldset = document.createElement('fieldset');
		fieldset.classList.add('view-settings-fieldset');
		divContainer.appendChild(fieldset);

		fieldset.appendChild(this.createLegend(_('Option')));

		for (const key in data) {
			const label = this._viewSettingLabels[key];
			if (!label) {
				continue;
			}
			if (typeof data[key] === 'boolean') {
				fieldset.appendChild(this.createViewSettingCheckbox(key, data, label));
			} else if (typeof data[key] === 'string') {
				fieldset.appendChild(this.createViewSettingsTextBox(key, data));
			}
		}

		viewContainer.appendChild(this.createViewSettingActions());
		settingsContainer.appendChild(viewContainer);
	}

	private createLegend(text: string): HTMLLegendElement {
		const legend = document.createElement('legend');
		legend.textContent = text;
		return legend;
	}

	private createViewSettingsTextBox(key: string, data: any): HTMLDivElement {
		const text = data[key];
		let result: HTMLDivElement = document.createElement('div');
		if (key === 'zoteroAPIKey') {
			result = this.createZoteroConfig(text, data);
		}
		return result;
	}

	private createViewSettingCheckbox(
		key: string,
		data: any,
		label: string,
	): HTMLSpanElement {
		const isChecked = data[key];
		let isDisabled = false;
		let warningText: string | null = null;

		if (key === 'accessibilityState') {
			isDisabled = !window.enableAccessibility;
			if (isDisabled) {
				warningText = _(
					'(Warning: Server accessibility must be enabled to toggle)',
				);
			}
		}

		// Replaced direct checkbox input creation with the new helper
		return this.createCheckbox(
			key,
			isChecked && !isDisabled,
			label,
			(inputCheckbox, checkboxWrapper, materialIconContainer) => {
				const currentChecked = !inputCheckbox.checked;
				inputCheckbox.checked = currentChecked;
				checkboxWrapper.classList.toggle(
					'checkbox-radio-switch--checked',
					!currentChecked,
				);
				materialIconContainer.innerHTML = currentChecked
					? this.SVG_ICONS.checkboxMarked
					: this.SVG_ICONS.checkboxBlankOutline;
				data[key] = currentChecked;
			},
			isDisabled,
			warningText,
		);
	}

	private createViewSettingActions(): HTMLDivElement {
		const actionsContainer = document.createElement('div');
		actionsContainer.classList.add('xcu-editor-actions');

		const resetButton = this.createButtonWithIcon(
			'xcu-reset-button',
			'reset', // Use icon key
			_('Reset to default View settings'),
			['button--vue-secondary', 'xcu-reset-icon'],
			async (button) => {
				const confirmed = window.confirm(
					_('Are you sure you want to reset View Settings?'),
				);
				if (!confirmed) {
					return;
				}
				button.disabled = true;
				const defaultViewSetting = {
					accessibilityState: false,
					zoteroAPIKey: '',
				};
				await this.uploadViewSettingFile(
					'viewsetting.json',
					JSON.stringify(defaultViewSetting),
				);
				button.disabled = false;
			},
			true,
		);
		actionsContainer.appendChild(resetButton);

		const saveButton = this.createButtonWithText(
			'xcu-save-button',
			_('Save'),
			_('Save View Settings'),
			['button-primary'],
			async (button) => {
				button.disabled = true;
				await this.uploadViewSettingFile(
					'viewsetting.json',
					JSON.stringify(this._viewSetting),
				);
				button.disabled = false;
			},
		);
		actionsContainer.appendChild(saveButton);

		return actionsContainer;
	}

	private async populateSharedConfigUI(data: ConfigData): Promise<void> {
		const browserSettingButton = document.getElementById(
			'uploadBrowserSettingsButton',
		) as HTMLButtonElement | null;

		if (browserSettingButton) {
			if (data.browsersetting && data.browsersetting.length > 0) {
				browserSettingButton.style.display = 'none';
			} else {
				browserSettingButton.style.removeProperty('display');
			}
		}

		const xcuSettingButton = document.getElementById(
			'uploadXcuButton',
		) as HTMLButtonElement | null;

		if (xcuSettingButton) {
			if (data.xcu && data.xcu.length > 0) {
				xcuSettingButton.style.display = 'none';
			} else {
				xcuSettingButton.style.removeProperty('display');
			}
		}

		if (data.kind === 'user') {
			if (data.viewsetting && data.viewsetting.length > 0) {
				const fileId = data.viewsetting[0].uri;
				const fetchContent = await this.fetchSettingFile(fileId);
				if (fetchContent) this.generateViewSettingUI(JSON.parse(fetchContent));
			} else {
				const defaultViewSetting = {
					accessibilityState: false,
					zoteroAPIKey: '',
				};
				this.generateViewSettingUI(defaultViewSetting);
			}

			// browser settings
			if (data.browsersetting && data.browsersetting.length > 0) {
				const fileId = data.browsersetting[0].uri;
				const browserSettingContent = await this.fetchSettingFile(fileId);
				this.browserSettingOptions = browserSettingContent
					? this.mergeWithDefault(
							defaultBrowserSetting,
							JSON.parse(browserSettingContent),
						)
					: defaultBrowserSetting;
			} else {
				this.browserSettingOptions = defaultBrowserSetting;
			}
			this.createBrowserSettingForm(
				document.getElementById('allConfigSection')!,
			);
		}

		const settingsContainer = document.getElementById('allConfigSection');
		if (!settingsContainer) return;
		if (data.xcu && data.xcu.length > 0) {
			const fileId = data.xcu[0].uri;
			const xcuFileContent = await this.fetchSettingFile(fileId);
			this.xcuEditor = new (window as any).Xcu(
				this.getFilename(fileId, false),
				xcuFileContent,
			);

			const existingXcuSection = document.getElementById('xcu-section');
			if (existingXcuSection) {
				existingXcuSection.remove();
			}

			const xcuContainer = document.createElement('div');
			xcuContainer.id = 'xcu-section';
			xcuContainer.classList.add('section');
			settingsContainer.appendChild(
				this.xcuEditor.createXcuEditorUI(xcuContainer),
			);
		} else {
			// If user doesn't have any xcu file, we generate with default settings...
			this.xcuEditor = new (window as any).Xcu('documentView.xcu', null);
			this.xcuEditor.generateXcuAndUpload();
			return await this.fetchAndPopulateSharedConfigs();
		}

		if (data.autotext)
			this.populateList('autotextList', data.autotext, '/autotext');
		if (data.wordbook)
			this.populateList('wordbookList', data.wordbook, '/wordbook');
		if (data.xcu) this.populateList('XcuList', data.xcu, '/xcu');
	}

	private mergeWithDefault(defaults: any, overrides: any): any {
		const result: any = {};

		for (const key in defaults) {
			const value = defaults[key];
			const override = overrides?.[key];

			if (
				typeof value === 'boolean' ||
				(typeof value === 'object' && value !== null && 'customType' in value)
			) {
				// Use override directly for booleans or objects with customType (set value)
				result[key] =
					typeof override === 'boolean'
						? typeof value === 'object'
							? { ...value, value: override }
							: override
						: value;
			} else if (typeof value === 'object' && value !== null) {
				result[key] = this.mergeWithDefault(value, override);
			} else {
				result[key] = override !== undefined ? override : value;
			}
		}

		return result;
	}

	private createZoteroConfig(APIKey: string = '', data) {
		const zoteroContainer = document.createElement('div');

		zoteroContainer.id = 'zoterocontainer';
		zoteroContainer.classList.add('section');
		zoteroContainer.appendChild(this.createHeading('Zotero'));

		const zotero = this.createTextInput(
			'zotero',
			_('Enter Zotero API Key'),
			APIKey,
			(input) => {
				data['zoteroAPIKey'] = input.value;
			},
		);
		zoteroContainer.appendChild(zotero);

		return zoteroContainer;
	}

	private getConfigType(): string {
		return this.isAdmin() ? 'systemconfig' : 'userconfig';
	}

	private isAdmin(): boolean {
		return window.iframeType === 'admin';
	}

	static showErrorModal(message: string): void {
		const modal = document.createElement('div');
		modal.className = 'modal';

		const modalContent = document.createElement('div');
		modalContent.className = 'modal-content';

		const header = document.createElement('h2');
		header.textContent = _('Error');
		header.style.textAlign = 'center';
		modalContent.appendChild(header);

		const messageEl = document.createElement('p');
		messageEl.textContent = message;
		modalContent.appendChild(messageEl);

		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'modal-button-container';

		const okButton = document.createElement('button');
		okButton.textContent = _('OK');
		okButton.classList.add('button', 'button--vue-secondary');
		okButton.addEventListener('click', () => {
			document.body.removeChild(modal);
		});

		buttonContainer.appendChild(okButton);
		modalContent.appendChild(buttonContainer);

		modal.appendChild(modalContent);
		document.body.appendChild(modal);
	}

	private settingConfigBasePath(): string {
		return '/settings/' + this.getConfigType();
	}

	private getFilename(uri: string, removeExtension = true): string {
		let filename = uri.substring(uri.lastIndexOf('/') + 1);
		if (removeExtension) {
			filename = filename.replace(/\.[^.]+$/, '');
		}
		return filename;
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const adminContainer = document.getElementById('allConfigSection');
	if (adminContainer) {
		initTranslationStr();
		(window as any).settingIframe = new SettingIframe();
		(window as any).settingIframe.init();
		const postHeight = () => {
			window.parent.postMessage(
				{
					MessageId: 'Iframe_Height',
					SendTime: Date.now(),
					Values: {
						ContentHeight: document.documentElement.offsetHeight + 'px',
					},
				},
				'*',
			);
		};

		let timeout: any;
		const debouncePostHeight = () => {
			clearTimeout(timeout);
			timeout = setTimeout(postHeight, 100);
		};

		const mutationObserver = new MutationObserver(debouncePostHeight);
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
		});
	}
});

(window as any)._ = _;
