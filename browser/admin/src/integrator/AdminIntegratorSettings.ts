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
	};
	private readonly settingLabels: Record<string, string> = {
		darkTheme: 'Dark mode',
		compactMode: 'Compact layout',
		ShowStatusbar: 'Show status bar',
		ShowRuler: 'Show ruler',
		A11yCheckDeck: 'Accessibility Checker',
		NavigatorDeck: 'Navigator',
		PropertyDeck: 'Show Sidebar',
		SdCustomAnimationDeck: 'Custom Animation',
		SdMasterPagesDeck: 'Master Pages',
		SdSlideTransitionDeck: 'Slide Transition',
		StyleListDeck: 'Style List',
		// Add more as needed
	};

	private API_ENDPOINTS = {
		uploadSettings: window.enableDebug
			? '/wopi/settings/upload'
			: '/browser/dist/upload-settings',
		fetchSharedConfig: '/browser/dist/fetch-settings-config',
		deleteSharedConfig: '/browser/dist/delete-settings-config',
		fetchSettingFile: '/browser/dist/fetch-settings-file',
	};

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
			const response = await fetch(this.API_ENDPOINTS.fetchSharedConfig, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${window.accessToken}`,
				},
				body: formData,
			});

			if (!response.ok) {
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

		const headingEl = document.createElement('h3');
		headingEl.textContent = config.sectionTitle;

		const descEl = document.createElement('p');
		descEl.textContent = config.sectionDesc;

		const ulEl = document.createElement('ul');
		ulEl.id = config.listId;

		const inputEl = document.createElement('input');
		inputEl.type = 'file';
		inputEl.classList.add('hidden');
		inputEl.id = config.inputId;
		inputEl.accept = config.fileAccept;

		const buttonEl = document.createElement('button');
		buttonEl.id = config.buttonId;
		buttonEl.type = 'button';
		buttonEl.classList.add(
			'inline-button',
			'button',
			'button--text-only',
			'button--vue-secondary',
		);
		buttonEl.innerHTML = `
		  <span class="button__wrapper">
			<span class="button__text">${config.buttonText}</span>
		  </span>
		`;

		sectionEl.appendChild(headingEl);
		sectionEl.appendChild(descEl);
		sectionEl.appendChild(ulEl);
		sectionEl.appendChild(inputEl);
		sectionEl.appendChild(buttonEl);

		return sectionEl;
	}

	private async fetchSettingFile(fileId: string) {
		try {
			const formData = new FormData();
			formData.append('fileUrl', fileId);
			formData.append('accessToken', window.accessToken ?? '');

			const apiUrl = this.API_ENDPOINTS.fetchSettingFile;

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
		// Main Title and Description
		const mainTitle = document.createElement('h3');
		mainTitle.textContent = _('Interface Settings');
		editorContainer.appendChild(mainTitle);

		const mainDescription = document.createElement('p');
		mainDescription.textContent = _('Set default interface preferences.');
		editorContainer.appendChild(mainDescription);

		const navContainer = document.createElement('div');
		navContainer.className = 'browser-setting-tabs-nav';

		const tabs = [
			{ id: 'spreadsheet', label: 'Calc' },
			{ id: 'text', label: 'Writer' },
			{ id: 'presentation', label: 'Impress' },
			{ id: 'drawing', label: 'Draw' },
		];

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
		tabs.forEach((tab) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = '';
			btn.id = `bs-tab-${tab.id}`; // bs => Browser Setting
			btn.className = `browser-setting-tab`;
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

		const contentsContainer = document.createElement('div');
		contentsContainer.id = 'tab-contents-browserSetting';
		contentsContainer.textContent = _('Select a tab to browser settings.');
		// Save and Reset Buttons
		const actionsContainer = document.createElement('div');
		actionsContainer.classList.add('browser-settings-editor-actions');

		const resetButton = document.createElement('button');
		resetButton.type = 'button';
		resetButton.id = 'browser-settings-reset-button';
		resetButton.classList.add('button', 'button--vue-secondary');
		resetButton.title = _('Reset to default Document settings');
		resetButton.innerHTML = `
			<span class="button__wrapper">
				<span class="button__icon xcu-reset-icon">
				<svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
					<!-- Replace with your Reset icon SVG path -->
					<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.03.67-.08 1h2.02c.05-.33.06-.66.06-1 0-4.42-3.58-8-8-8zm-6 7c0-.34.03-.67.08-1H4.06c-.05.33-.06.66-.06 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6z"></path>
				</svg>
				</span>
			</span>
			`;

		resetButton.addEventListener('click', async () => {
			const confirmed = window.confirm(
				_('Are you sure you want to reset Document settings?'),
			);
			if (!confirmed) {
				return;
			}
			// Deep clone the default to avoid reference issues
			this.browserSettingOptions = JSON.parse(
				JSON.stringify(defaultBrowserSetting),
			);
			this.createBrowserSettingForm(sharedConfigsContainer);
		});
		actionsContainer.appendChild(resetButton);
		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.id = 'browser-settings-save-button';
		saveButton.classList.add('button', 'button-primary');
		saveButton.title = _('Save Document settings');
		saveButton.innerHTML = `
			<span class="button__wrapper">
				<span class="button--text-only">Save</span>
			</span>
			`;

		saveButton.addEventListener('click', async () => {
			saveButton.disabled = true;
			this.collectBrowserSettingsFromUI(editorContainer);

			const file = new File(
				[JSON.stringify(this.browserSettingOptions)],
				'browsersetting.json',
				{
					type: 'application/json',
					lastModified: Date.now(),
				},
			);

			// Replace `cfg.uploadPath` with the actual path you're using
			await this.uploadFile(this.PATH.browserSettingsUpload(), file);
			saveButton.disabled = false;
		});
		actionsContainer.appendChild(saveButton);

		editorContainer.appendChild(navContainer);
		editorContainer.appendChild(contentsContainer);
		editorContainer.appendChild(actionsContainer);
		// Find old editor if present
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
					const fieldset = document.createElement('fieldset');
					fieldset.classList.add('xcu-settings-fieldset');
					const legend = document.createElement('legend');
					legend.textContent = _(this.settingLabels[key] || key);
					fieldset.appendChild(legend);
					const childContent = this.renderSettingsOption(value, uniqueId);
					fieldset.appendChild(childContent);
					container.appendChild(fieldset);
				} else {
					const isCheck: boolean = value;
					const checkboxWrapper = document.createElement('span');
					checkboxWrapper.className = `checkbox-radio-switch checkbox-radio-switch-checkbox ${isCheck ? '' : 'checkbox-radio-switch--checked'} checkbox-wrapper`;
					checkboxWrapper.id = uniqueId + '-container';

					const inputCheckbox = document.createElement('input');
					inputCheckbox.type = 'checkbox';
					inputCheckbox.className = 'checkbox-radio-switch-input';
					inputCheckbox.id = uniqueId + '-input';
					inputCheckbox.checked = isCheck;
					checkboxWrapper.appendChild(inputCheckbox);

					const checkboxContent = document.createElement('span');
					checkboxContent.className =
						'checkbox-content checkbox-content-checkbox checkbox-content--has-text checkbox-radio-switch__content';
					checkboxContent.id = uniqueId + '-content';
					checkboxWrapper.appendChild(checkboxContent);

					const checkboxContentIcon = document.createElement('span');
					checkboxContentIcon.className = `checkbox-content-icon checkbox-radio-switch__icon ${isCheck ? '' : 'checkbox-content-icon--checked'}`;
					checkboxContentIcon.ariaHidden = 'true';
					checkboxContent.appendChild(checkboxContentIcon);

					const materialIcon = document.createElement('span');
					materialIcon.className = `material-design-icon ${isCheck ? 'checkbox-marked-icon' : 'checkbox-blank-outline-icon'}`;
					materialIcon.ariaHidden = 'true';

					const iconSvg = `
					<svg fill="currentColor" class="material-design-icon__svg" width="24" height="24" viewBox="0 0 24 24">
					${
						isCheck
							? `<path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z">
							<!---->
						  </path>`
							: `<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
							<!---->
						  </path>`
					}
					</svg>`;

					checkboxContentIcon.appendChild(materialIcon);
					materialIcon.innerHTML = iconSvg;

					const textElement = document.createElement('span');
					textElement.className =
						'checkbox-content__text checkbox-radio-switch__text';
					textElement.textContent = _(this.settingLabels[key] || key);
					checkboxContent.appendChild(textElement);

					checkboxWrapper.addEventListener('click', () => {
						const currentChecked = !(inputCheckbox as HTMLInputElement).checked;
						inputCheckbox.checked = currentChecked;
						if (currentChecked) {
							checkboxWrapper.classList.remove(
								'checkbox-radio-switch--checked',
							);
						} else {
							checkboxWrapper.classList.add('checkbox-radio-switch--checked');
						}
						materialIcon.innerHTML = `
							<svg fill="currentColor" class="material-design-icon__svg" width="24" height="24" viewBox="0 0 24 24">
							${
								currentChecked
									? `<path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z">
									<!---->
								</path>`
									: `<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
									<!---->
								</path>`
							}
							</svg>`;

						data[key] = currentChecked;
					});

					container.appendChild(checkboxWrapper);
				}
			}
		}
		return container;
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
		options.className = 'toggle-options'; // You can style with flex and gap

		// Create option for Notebookbar
		const notebookOption = document.createElement('div');
		notebookOption.className = 'toggle-option';
		const notebookImage = document.createElement('img');
		notebookImage.src = 'images/Notebookbar.svg';
		notebookImage.alt = 'Notebookbar';
		notebookImage.className = `toggle-image ${!setting.value ? 'selected' : ''}`;
		const notebookLabel = document.createElement('div');
		notebookLabel.textContent = _('Notebookbar view');
		notebookLabel.className = 'toggle-image-label';
		notebookOption.appendChild(notebookImage);
		notebookOption.appendChild(notebookLabel);

		// Create option for Compact mode
		const compactOption = document.createElement('div');
		compactOption.className = 'toggle-option';
		const compactImage = document.createElement('img');
		compactImage.src = 'images/Compact.svg';
		compactImage.alt = 'Compact';
		compactImage.className = `toggle-image ${setting.value ? 'selected' : ''}`;
		const compactLabel = document.createElement('div');
		compactLabel.textContent = _('Compact view');
		compactLabel.className = 'toggle-image-label';
		compactOption.appendChild(compactImage);
		compactOption.appendChild(compactLabel);

		const select = (useCompact: boolean) => {
			inputCheckbox.checked = useCompact;
			setting.value = useCompact;

			notebookImage.classList.toggle('selected', !useCompact);
			compactImage.classList.toggle('selected', useCompact);
		};

		notebookImage.addEventListener('click', () => select(false));
		compactImage.addEventListener('click', () => select(true));

		options.appendChild(notebookOption);
		options.appendChild(compactOption);
		container.appendChild(options);

		return container;
	}

	private async uploadFile(filePath: string, file: File): Promise<void> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('filePath', filePath);
		if (window.wopiSettingBaseUrl) {
			formData.append('wopiSettingBaseUrl', window.wopiSettingBaseUrl);
		}

		try {
			const apiUrl = this.API_ENDPOINTS.uploadSettings;

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

			const extraActionsDiv = document.createElement('div');
			extraActionsDiv.classList.add('list-item-content__extra-actions');

			const downloadBtn = document.createElement('button');
			downloadBtn.type = 'button';
			downloadBtn.classList.add(
				'button',
				'button--icon-only',
				'button--vue-secondary',
				'download-icon',
			);

			// todo : replace svg to css class?
			downloadBtn.innerHTML = `
				<span class="button__wrapper">
					<span aria-hidden="true" class="button__icon">
						<span aria-hidden="true" role="img" class="material-design-icon">
							<svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24" class="material-design-icon__svg">
								<path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"></path>
							</svg>
						</span>
					</span>
				</span>
			`;
			downloadBtn.addEventListener('click', () => {
				window.open(item.uri, '_blank');
			});

			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.classList.add(
				'button',
				'button--icon-only',
				'button--vue-secondary',
				'delete-icon',
			);
			deleteBtn.innerHTML = `
				<span class="button__wrapper">
					<span aria-hidden="true" class="button__icon">
						<span aria-hidden="true" role="img" class="material-design-icon">
							<svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24" class="material-design-icon__svg">
								<path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19
									A2,2 0 0,0 8,21H16
									A2,2 0 0,0 18,19V7H6V19Z"></path>
							</svg>
						</span>
					</span>
				</span>
			`;
			deleteBtn.addEventListener('click', async () => {
				try {
					if (!window.accessToken) {
						throw new Error('Access token is missing.');
					}
					if (!window.wopiSettingBaseUrl) {
						throw new Error('wopiSettingBaseUrl is missing.');
					}

					const fileId =
						this.settingConfigBasePath() +
						category +
						'/' +
						this.getFilename(item.uri, false);

					const formData = new FormData();
					formData.append('fileId', fileId);
					formData.append('sharedConfigUrl', window.wopiSettingBaseUrl);
					formData.append('accessToken', window.accessToken);

					const response = await fetch(this.API_ENDPOINTS.deleteSharedConfig, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${window.accessToken}`,
						},
						body: formData,
					});

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
			});

			extraActionsDiv.append(downloadBtn, deleteBtn);

			// Add an "Edit" button for wordbook file only
			if (category === '/wordbook') {
				const editBtn = document.createElement('button');
				editBtn.type = 'button';
				editBtn.classList.add(
					'button',
					'button--icon-only',
					'button--vue-secondary',
					'edit-icon',
				);
				editBtn.innerHTML = `
					<span class="button__wrapper">
						<span aria-hidden="true" class="button__icon">
							<span aria-hidden="true" role="img" class="material-design-icon">
								<svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24">
									<path d="M3 17.25V21h3.75l11-11.03-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
								</svg>
							</span>
						</span>
					</span>
				`;
				editBtn.addEventListener('click', async () => {
					await this.fetchWordbookFile(item.uri);
				});
				extraActionsDiv.appendChild(editBtn);
			}

			listItemDiv.append(anchor, extraActionsDiv);
			li.appendChild(listItemDiv);
			listEl.appendChild(li);
		});
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

		let elem = document.createElement('h3');
		elem.textContent = _('View Settings');
		viewContainer.appendChild(elem);

		elem = document.createElement('p');
		elem.textContent = _('Adjust view settings.');
		viewContainer.appendChild(elem);

		const divContainer = document.createElement('div');
		divContainer.id = 'view-editor';
		viewContainer.appendChild(divContainer);

		const fieldset = document.createElement('fieldset');
		fieldset.classList.add('view-settings-fieldset');
		divContainer.appendChild(fieldset);

		elem = document.createElement('legend');
		elem.textContent = _('Option');
		fieldset.appendChild(elem);

		for (const key in data) {
			if (typeof data[key] === 'boolean') {
				const label = this._viewSettingLabels[key];
				if (!label) {
					continue;
				}

				const checkboxContainer = document.createElement('span');
				checkboxContainer.className =
					'checkbox-radio-switch checkbox-radio-switch-checkbox checkbox-wrapper';
				fieldset.appendChild(checkboxContainer);

				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.className = 'checkbox-radio-switch-input';
				checkbox.checked = data[key];
				if (key === 'accessibilityState') {
					checkbox.checked = checkbox.checked && window.enableAccessibility;
					checkbox.disabled = !window.enableAccessibility;
				}
				checkboxContainer.appendChild(checkbox);

				const checkboxContent = document.createElement('span');
				checkboxContent.className =
					'checkbox-content checkbox-content-checkbox checkbox-content--has-text checkbox-radio-switch__content';
				checkboxContainer.appendChild(checkboxContent);

				const checkboxIcon = document.createElement('span');
				checkboxIcon.className = `checkbox-content-icon checkbox-radio-switch__icon`;
				checkboxIcon.ariaHidden = 'true';
				checkboxContent.appendChild(checkboxIcon);

				const materialIcon = document.createElement('span');
				materialIcon.className = 'material-design-icon checkbox-marked-icon';
				materialIcon.ariaHidden = 'true';

				const iconSvg = `
					<svg fill="currentColor" class="material-design-icon__svg" width="24" height="24" viewBox="0 0 24 24">
					${
						checkbox.checked
							? `<path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z">
						  </path>`
							: `<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
						  </path>`
					}
					</svg>`;

				materialIcon.innerHTML = iconSvg;
				checkboxIcon.appendChild(materialIcon);

				const checkboxText = document.createElement('span');
				checkboxText.className =
					'checkbox-content__text checkbox-radio-switch__text';
				checkboxText.textContent = label;
				checkboxContent.appendChild(checkboxText);

				if (checkbox.disabled) {
					if (key === 'accessibilityState') {
						// This has no effect if coolwsd accessibility.enable is not set. So present as disabled,
						// and warn that it cannot be toggled unless coolwsd accessibility is on so we don't have
						// a situation of a checkbox that doesn't actually do anything.
						const warningText = document.createElement('span');
						warningText.className = 'ui-state-error-text';
						warningText.textContent = _(
							'(Warning: Server accessibility must be enabled to toggle)',
						);
						checkboxContent.appendChild(warningText);
					}
				} else {
					checkboxContainer.addEventListener(
						'click',
						function () {
							const currentChecked = !this.checked;
							this.checked = currentChecked;
							if (currentChecked) {
								checkboxContainer.classList.remove(
									'checkbox-radio-switch--checked',
								);
							} else {
								checkboxContainer.classList.add(
									'checkbox-radio-switch--checked',
								);
							}
							materialIcon.innerHTML = `
	<svg fill="currentColor" class="material-design-icon__svg" width="24" height="24" viewBox="0 0 24 24">
	${
		currentChecked
			? `<path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z">
							</path>`
			: `<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
							</path>`
	}
	</svg>`;
							data[key] = currentChecked;
						}.bind(checkbox),
					);
				}
			}
		}

		const actionsContainer = document.createElement('div');
		actionsContainer.classList.add('xcu-editor-actions');

		const resetButton = document.createElement('button');
		resetButton.type = 'button';
		resetButton.id = 'xcu-reset-button';
		resetButton.classList.add('button', 'button--vue-secondary');
		resetButton.title = _('Reset to default View settings');
		resetButton.innerHTML = `
			<span class="button__wrapper">
				<span class="button__icon xcu-reset-icon">
				<svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
					<!-- Replace with your Reset icon SVG path -->
					<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.03.67-.08 1h2.02c.05-.33.06-.66.06-1 0-4.42-3.58-8-8-8zm-6 7c0-.34.03-.67.08-1H4.06c-.05.33-.06.66-.06 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6z"></path>
				</svg>
				</span>
			</span>
			`;

		resetButton.addEventListener('click', async () => {
			const confirmed = window.confirm(
				_('Are you sure you want to reset View Settings?'),
			);
			if (!confirmed) {
				return;
			}
			resetButton.disabled = true;
			const defaultViewSetting = { accessibilityState: false };
			this.uploadViewSettingFile(
				'viewsetting.json',
				JSON.stringify(defaultViewSetting),
			);
			resetButton.disabled = false;
		});

		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.id = 'xcu-save-button';
		saveButton.classList.add('button', 'button-primary');
		saveButton.title = _('Save View Settings');
		saveButton.innerHTML = `
			<span class="button__wrapper">
				<span class="button--text-only">Save</span>
			</span>
			`;

		saveButton.addEventListener('click', async () => {
			saveButton.disabled = true;
			this.uploadViewSettingFile(
				'viewsetting.json',
				JSON.stringify(this._viewSetting),
			);
			saveButton.disabled = false;
		});

		actionsContainer.appendChild(resetButton);
		actionsContainer.appendChild(saveButton);
		viewContainer.appendChild(actionsContainer);

		settingsContainer.appendChild(viewContainer);
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
				const defaultViewSetting = { accessibilityState: false };
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
