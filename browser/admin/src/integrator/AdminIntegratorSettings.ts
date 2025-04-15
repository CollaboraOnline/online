/* eslint-disable */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

interface Window {
	accessToken?: string;
	accessTokenTTL?: string;
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

class SettingIframe {
	private wordbook;
	private xcuEditor;

	private API_ENDPOINTS = {
		uploadSettings: window.enableDebug
			? '/wopi/settings/upload'
			: '/browser/dist/upload-settings',
		fetchSharedConfig: '/browser/dist/fetch-settings-config',
		deleteSharedConfig: '/browser/dist/delete-settings-config',
		fetchWordbook: 'browser/dist/fetch-wordbook',
	};

	private PATH = {
		autoTextUpload: () => this.settingConfigBasePath() + '/autotext/',
		wordBookUpload: () => this.settingConfigBasePath() + '/wordbook/',
		browserSettingsUpload: () =>
			this.settingConfigBasePath() + '/browsersetting/',
		XcuUpload: () => this.settingConfigBasePath() + '/xcu/',
	};

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

	private initWindowVariables(): void {
		const element = document.getElementById('initial-variables');
		if (!element) return;

		window.accessToken = element.dataset.accessToken;
		window.accessTokenTTL = element.dataset.accessTokenTtl;
		window.enableDebug = element.dataset.enableDebug === 'true';
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

	private insertConfigSections(): void {
		const sharedConfigsContainer = document.getElementById('allConfigSection');
		if (!sharedConfigsContainer) return;

		const configSections: SectionConfig[] = [
			{
				sectionTitle: 'Autotext',
				sectionDesc:
					'Upload reusable text snippets (.bau). To insert the text in your document, type the shortcut for an AutoText entry and press F3.',
				listId: 'autotextList',
				inputId: 'autotextFile',
				buttonId: 'uploadAutotextButton',
				fileAccept: '.bau',
				buttonText: 'Upload Autotext',
				uploadPath: this.PATH.autoTextUpload(),
			},
			{
				sectionTitle: 'Custom Dictionaries',
				sectionDesc:
					'Add or edit words in a spell check dictionary. Words in your wordbook (.dic) will be available for spelling checks.',
				listId: 'wordbookList',
				inputId: 'wordbookFile',
				buttonId: 'uploadWordbookButton',
				fileAccept: '.dic',
				buttonText: 'Upload Wordbook',
				uploadPath: this.PATH.wordBookUpload(),
			},
			{
				sectionTitle: 'Interface',
				sectionDesc: 'Set default interface preferences.',
				listId: 'BrowserSettingsList',
				inputId: 'BrowserSettingsFile',
				buttonId: 'uploadBrowserSettingsButton',
				fileAccept: '.json',
				// TODO: replace btn with rich interface (toggles)
				buttonText: 'Upload Configuration',
				uploadPath: this.PATH.browserSettingsUpload(),
				enabledFor: 'userconfig',
			},
			{
				sectionTitle: 'Document View',
				sectionDesc: 'Adjust how office documents look.',
				listId: 'XcuList',
				inputId: 'XcuFile',
				buttonId: 'uploadXcuButton',
				fileAccept: '.xcu',
				// TODO: replace btn with rich interface (toggles)
				buttonText: 'Upload Xcu',
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

				fileInput.addEventListener('change', () => {
					if (fileInput.files?.length) {
						if (cfg.uploadPath === this.PATH.wordBookUpload()) {
							this.wordbook.wordbookValidation(
								cfg.uploadPath,
								fileInput.files[0],
							);
						} else {
							this.uploadFile(cfg.uploadPath, fileInput.files[0]);
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
			console.error('Shared Config URL is missing in initial variables.');
			return;
		}
		console.debug('iframeType page', window.iframeType);

		if (!window.accessToken) {
			console.error('Access token is missing in initial variables.');
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
			this.showErrorModal(
				'Something went wrong, Please try to refresh the page.',
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

			const apiUrl = this.API_ENDPOINTS.fetchWordbook;

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
			this.showErrorModal(
				'Something went wrong while fetching setting file, Please try to refresh the page.',
			);
			return null;
		}
	}

	// TODO: Re-use fetchSettingFile function to fetch wordbook?
	private async fetchWordbookFile(fileId: string): Promise<void> {
		this.wordbook.startLoader();
		const formData = new FormData();
		formData.append('fileUrl', fileId);
		formData.append('accessToken', window.accessToken ?? '');
		try {
			const apiUrl = this.API_ENDPOINTS.fetchWordbook;

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

			let textValue = await response.text();
			console.debug('textValue: ', textValue);

			const wordbook = await this.wordbook.parseWordbookFileAsync(textValue);
			const fileName = this.getFilename(fileId, false);
			this.wordbook.stopLoader();
			this.wordbook.openWordbookEditor(fileName, wordbook);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Error uploading file: ${message}`);
			this.showErrorModal(
				'Something went wrong while fetching wordbook, Please try to refresh the page.',
			);
			this.wordbook.stopLoader();
		}
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
			this.showErrorModal(
				'Something went wrong while uploading the file. Please try again.',
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
					this.showErrorModal(
						'Something went wrong while deleting the file. Please try refreshing the page.',
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

		if (data.xcu && data.xcu.length > 0) {
			const fileId = data.xcu[0].uri;
			const xcuFileContent = await this.fetchSettingFile(fileId);
			this.xcuEditor = new (window as any).Xcu(
				this.getFilename(fileId, false),
				xcuFileContent,
			);

			const settingsContainer = document.getElementById('allConfigSection');
			if (!settingsContainer) return;

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
			// If user don't have any xcu file, We generate with default settings...
			this.xcuEditor = new (window as any).Xcu('documentView.xcu', null);
			this.xcuEditor.generateXcuAndUpload();
			return await this.fetchAndPopulateSharedConfigs();
		}

		if (data.autotext)
			this.populateList('autotextList', data.autotext, '/autotext');
		if (data.wordbook)
			this.populateList('wordbookList', data.wordbook, '/wordbook');
		if (data.browsersetting)
			this.populateList(
				'BrowserSettingsList',
				data.browsersetting,
				'/browsersetting',
			);
		if (data.xcu) this.populateList('XcuList', data.xcu, '/xcu');
	}

	private getConfigType(): string {
		return this.isAdmin() ? 'systemconfig' : 'userconfig';
	}

	private isAdmin(): boolean {
		return window.iframeType === 'admin';
	}

	private showErrorModal(message: string): void {
		const modal = document.createElement('div');
		modal.className = 'modal';

		const modalContent = document.createElement('div');
		modalContent.className = 'modal-content';

		const header = document.createElement('h2');
		header.textContent = 'Error';
		header.style.textAlign = 'center';
		modalContent.appendChild(header);

		const messageEl = document.createElement('p');
		messageEl.textContent = message;
		modalContent.appendChild(messageEl);

		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'modal-button-container';

		const okButton = document.createElement('button');
		okButton.textContent = 'OK';
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
		(window as any).settingIframe = new SettingIframe();
		(window as any).settingIframe.init();
	}
});
