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
	listId: string;
	inputId: string;
	buttonId: string;
	fileAccept: string;
	buttonText: string;
	uploadPath: string;
	enabledFor?: string;
}

const API_ENDPOINTS = {
	uploadSettings: window.enableDebug
		? '/wopi/settings/upload'
		: '/browser/dist/upload-settings',
	fetchSharedConfig: '/browser/dist/fetch-settings-config',
	deleteSharedConfig: '/browser/dist/delete-settings-config',
	fetchDictionary: 'browser/dist/fetch-dic',
};

const PATH = {
	autoTextUpload: () => settingConfigBasePath() + '/autotext/',
	wordBookUpload: () => settingConfigBasePath() + '/wordbook/',
	browserSettingsUpload: () => settingConfigBasePath() + '/browsersetting/',
	XcuUpload: () => settingConfigBasePath() + '/xcu/',
};

// TODO: Move wordbook to separate class/module

interface DicFile {
	headerType: string; // eg. "OOoUserDict1"
	language: string; // the value after "lang:" (eg. "<none>")
	dictType: string; // the value after "type:" (eg. "positive")
	words: string[]; // list of dictionary words
}

// TODO: error handling for non parsed file - how we should handle it?
function parseDicFile(content: string): DicFile {
	const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
	const delimiterIndex = lines.findIndex((line) => line.trim() === '---');
	if (delimiterIndex === -1) {
		throw new Error('Invalid dictionary format: missing delimiter "---"');
	}
	if (delimiterIndex < 3) {
		throw new Error(
			'Invalid dictionary format: not enough header lines before delimiter',
		);
	}

	const headerType = lines[0].trim();

	const languageMatch = lines[1].trim().match(/^lang:\s*(.*)$/i);
	const language = languageMatch ? languageMatch[1].trim() : '';

	const typeMatch = lines[2].trim().match(/^type:\s*(.*)$/i);
	const dictType = typeMatch ? typeMatch[1].trim() : '';

	const words = lines
		.slice(delimiterIndex + 1)
		.filter((line) => line.trim() !== '');

	return { headerType, language, dictType, words };
}

function buildDicFile(dic: DicFile): string {
	const header = [
		dic.headerType.trim(),
		`lang: ${dic.language}`,
		`type: ${dic.dictType}`,
	];
	return [...header, '---', ...dic.words].join('\n');
}

function updateWordList(listEl: HTMLElement, dic: DicFile): void {
	listEl.innerHTML = '';
	dic.words.forEach((word, index) => {
		// TODO IDEA: Extract list as components?

		const li = document.createElement('li');
		li.classList.add('list-item__wrapper');

		const listItemDiv = document.createElement('div');
		listItemDiv.classList.add('list-item');

		const wordContainer = document.createElement('div');
		wordContainer.classList.add('list-item__anchor');

		const wordContentDiv = document.createElement('div');
		wordContentDiv.classList.add('list-item-content');

		const wordTextDiv = document.createElement('div');
		wordTextDiv.classList.add('list-item-content__main');
		const wordNameDiv = document.createElement('div');
		wordNameDiv.classList.add('list-item-content__name');
		wordNameDiv.textContent = word;

		wordTextDiv.appendChild(wordNameDiv);
		wordContentDiv.appendChild(wordTextDiv);
		wordContainer.appendChild(wordContentDiv);

		listItemDiv.appendChild(wordContainer);

		const delButton = document.createElement('button');
		delButton.type = 'button';
		delButton.classList.add(
			'button',
			'button--size-normal',
			'button--icon-only',
			'button--vue-secondary',
			'delete-icon',
		);
		delButton.innerHTML = `
		<span class="button__wrapper">
		  <span aria-hidden="true" class="button__icon">
			<span aria-hidden="true" role="img" class="material-design-icon">
			  <svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24">
				<path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19
						  A2,2 0 0,0 8,21H16
						  A2,2 0 0,0 18,19V7H6V19Z"></path>
			  </svg>
			</span>
		  </span>
		</span>
	  `;
		delButton.addEventListener('click', () => {
			dic.words.splice(index, 1);
			updateWordList(listEl, dic);
		});
		listItemDiv.appendChild(delButton);

		li.appendChild(listItemDiv);
		listEl.appendChild(li);
	});
}

function openDicEditor(fileName: string, dic: DicFile): void {
	const modal = document.createElement('div');
	modal.className = 'modal';

	const modalContent = document.createElement('div');
	modalContent.className = 'modal-content';

	const titleEl = document.createElement('h2');
	titleEl.textContent = `${fileName} (Edit)`;
	titleEl.style.textAlign = 'center';
	modalContent.appendChild(titleEl);

	const inputContainer = document.createElement('div');
	inputContainer.className = 'dic-input-container';
	inputContainer.style.margin = '16px 0';

	const newWordInput = document.createElement('input');
	newWordInput.type = 'text';
	newWordInput.placeholder = 'Enter new word';
	newWordInput.className = 'input-field__input';
	inputContainer.appendChild(newWordInput);

	const addButton = document.createElement('button');
	addButton.textContent = 'Add';
	addButton.className = 'button button--vue-secondary';
	addButton.style.marginLeft = '8px';
	addButton.addEventListener('click', () => {
		const newWord = newWordInput.value.trim();
		if (newWord) {
			dic.words.push(newWord);
			updateWordList(wordList, dic);
			newWordInput.value = '';
		}
	});
	inputContainer.appendChild(addButton);

	modalContent.appendChild(inputContainer);

	const wordList = document.createElement('ul');
	wordList.id = 'dicWordList';
	updateWordList(wordList, dic);
	modalContent.appendChild(wordList);

	const buttonContainer = document.createElement('div');
	buttonContainer.className = 'dic-button-container';
	buttonContainer.style.textAlign = 'center';
	buttonContainer.style.marginTop = '24px';

	const cancelButton = document.createElement('button');
	cancelButton.textContent = 'Cancel';
	cancelButton.className = 'button button--vue-tertiary';
	cancelButton.style.marginRight = '12px';
	cancelButton.addEventListener('click', () => {
		document.body.removeChild(modal);
	});
	buttonContainer.appendChild(cancelButton);

	const submitButton = document.createElement('button');
	submitButton.textContent = 'Submit';
	submitButton.className = 'button button--vue-primary';
	submitButton.addEventListener('click', async () => {
		console.debug('dic', dic);
		const updatedContent = buildDicFile(dic);
		console.debug('Updated Dictionary Content:\n', updatedContent);
		await updateDicFile(fileName, updatedContent);
		document.body.removeChild(modal);
	});

	buttonContainer.appendChild(submitButton);

	modalContent.appendChild(buttonContainer);
	modal.appendChild(modalContent);
	document.body.appendChild(modal);
}

async function updateDicFile(filename: string, content: string) {
	const file = new File([content], filename, { type: 'text/plain' });
	await uploadFile(PATH.wordBookUpload(), file);
}

async function fetchDicFile(fileId: string): Promise<void> {
	const formData = new FormData();
	formData.append('fileUrl', fileId);
	formData.append('accessToken', window.accessToken ?? '');
	try {
		const apiUrl = API_ENDPOINTS.fetchDictionary;

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

		const dic = parseDicFile(textValue);
		const fileName = getFilename(fileId, false);
		openDicEditor(fileName, dic);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error(`Error uploading file: ${message}`);
	}
}

function settingConfigBasePath(): string {
	return '/settings/' + getConfigType();
}

function getConfigType(): string {
	return isAdmin() ? 'systemconfig' : 'userconfig';
}

function isAdmin(): boolean {
	return window.iframeType === 'admin';
}

function init(): void {
	initWindowVariables();
	insertConfigSections();
	void fetchAndPopulateSharedConfigs();
}

function createConfigSection(config: SectionConfig): HTMLDivElement {
	const sectionEl = document.createElement('div');
	sectionEl.classList.add('section');

	const headingEl = document.createElement('h3');
	headingEl.textContent = config.sectionTitle;

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
		'button--size-normal',
		'button--text-only',
		'button--vue-secondary',
	);
	buttonEl.innerHTML = `
	  <span class="button__wrapper">
		<span class="button__text">${config.buttonText}</span>
	  </span>
	`;

	sectionEl.appendChild(headingEl);
	sectionEl.appendChild(ulEl);
	sectionEl.appendChild(inputEl);
	sectionEl.appendChild(buttonEl);

	return sectionEl;
}

function insertConfigSections(): void {
	const sharedConfigsContainer = document.getElementById('allConfigSection');
	if (!sharedConfigsContainer) return;

	const configSections: SectionConfig[] = [
		{
			sectionTitle: 'Autotext',
			listId: 'autotextList',
			inputId: 'autotextFile',
			buttonId: 'uploadAutotextButton',
			fileAccept: '.bau',
			buttonText: 'Upload Autotext',
			uploadPath: PATH.autoTextUpload(),
		},
		{
			sectionTitle: 'Wordbook',
			listId: 'wordbookList',
			inputId: 'wordbookFile',
			buttonId: 'uploadWordbookButton',
			fileAccept: '.dic',
			buttonText: 'Upload Wordbook',
			uploadPath: PATH.wordBookUpload(),
		},
		{
			sectionTitle: 'Browser Settings',
			listId: 'BrowserSettingsList',
			inputId: 'BrowserSettingsFile',
			buttonId: 'uploadBrowserSettingsButton',
			fileAccept: '.json',
			buttonText: 'Upload Browser Setting',
			uploadPath: PATH.browserSettingsUpload(),
			enabledFor: 'userconfig',
		},
		{
			sectionTitle: 'Xcu',
			listId: 'XcuList',
			inputId: 'XcuFile',
			buttonId: 'uploadXcuButton',
			fileAccept: '.xcu',
			buttonText: 'Upload Xcu',
			uploadPath: PATH.XcuUpload(),
		},
	];

	configSections.forEach((cfg) => {
		if (cfg.enabledFor && cfg.enabledFor !== getConfigType()) {
			return;
		}

		const sectionEl = createConfigSection(cfg);
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
					uploadFile(cfg.uploadPath, fileInput.files[0]);
					fileInput.value = '';
				}
			});
		}

		sharedConfigsContainer.appendChild(sectionEl);
	});
}

function initWindowVariables(): void {
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
		const styleEl = document.createElement('style');
		styleEl.setAttribute('id', 'dynamic-css-vars');
		styleEl.textContent = window.cssVars;
		document.head.appendChild(styleEl);
	}

	if (window.enableDebug) {
		const debugInfoList = document.createElement('ul');
		const debugInfoEle1 = document.createElement('li');
		debugInfoEle1.textContent = 'AccessToken: ' + window.accessToken;
		debugInfoList.append(debugInfoEle1);

		const debugInfoEle2 = document.createElement('li');
		debugInfoEle2.textContent = 'WOPI Base URL: ' + window.wopiSettingBaseUrl;
		debugInfoList.append(debugInfoEle2);

		const debugInfoEle3 = document.createElement('li');
		debugInfoEle3.textContent = 'IFrameType: ' + window.iframeType;
		debugInfoList.append(debugInfoEle3);

		const debugInfo = document.createElement('div');
		const debugInfoHeading = document.createElement('h4');
		debugInfoHeading.textContent = 'DebugInfo: ';
		debugInfo.append(debugInfoHeading);
		debugInfo.append(debugInfoList);

		const fileControls = document.getElementById('fileControls');
		fileControls?.append(debugInfo);
	}
}

// TODO: Upload dic file separately? We shouldn't allow to upload headers
async function uploadFile(filePath: string, file: File): Promise<void> {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('filePath', filePath);
	if (window.wopiSettingBaseUrl) {
		formData.append('wopiSettingBaseUrl', window.wopiSettingBaseUrl);
	}

	try {
		const apiUrl = API_ENDPOINTS.uploadSettings;

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

		await fetchAndPopulateSharedConfigs();
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error(`Error uploading file: ${message}`);
	}
}

async function fetchAndPopulateSharedConfigs(): Promise<void> {
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
	formData.append('type', getConfigType());

	try {
		const response = await fetch(API_ENDPOINTS.fetchSharedConfig, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${window.accessToken}`,
			},
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Could not fetch shared config: ${response.statusText}`);
		}

		const data: ConfigData = await response.json();
		populateSharedConfigUI(data);
		console.debug('Shared config data: ', data);
	} catch (error: unknown) {
		console.error('Error fetching shared config:', error);
	}
}

function getFilename(uri: string, removeExtension = true): string {
	let filename = uri.substring(uri.lastIndexOf('/') + 1);
	if (removeExtension) {
		filename = filename.replace(/\.[^.]+$/, '');
	}
	return filename;
}

function populateList(
	listId: string,
	items: ConfigItem[],
	category: string,
): void {
	const listEl = document.getElementById(listId);
	if (!listEl) return;

	listEl.innerHTML = '';

	items.forEach((item) => {
		const fileName = getFilename(item.uri, false);

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
			'button--size-normal',
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
			'button--size-normal',
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
					settingConfigBasePath() +
					category +
					'/' +
					getFilename(item.uri, false);

				const formData = new FormData();
				formData.append('fileId', fileId);
				formData.append('sharedConfigUrl', window.wopiSettingBaseUrl);
				formData.append('accessToken', window.accessToken);

				const response = await fetch(API_ENDPOINTS.deleteSharedConfig, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${window.accessToken}`,
					},
					body: formData,
				});

				if (!response.ok) {
					throw new Error(`Delete failed: ${response.statusText}`);
				}

				await fetchAndPopulateSharedConfigs();
			} catch (error: unknown) {
				console.error('Error deleting file:', error);
			}
		});

		extraActionsDiv.append(downloadBtn, deleteBtn);

		// Add an "Edit" button for dic file only
		if (category === '/wordbook') {
			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.classList.add(
				'button',
				'button--size-normal',
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
				await fetchDicFile(item.uri);
			});
			extraActionsDiv.appendChild(editBtn);
		}

		listItemDiv.append(anchor, extraActionsDiv);
		li.appendChild(listItemDiv);
		listEl.appendChild(li);
	});
}

function populateSharedConfigUI(data: ConfigData): void {
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

	// todo: dynamically generate this list too from configSections
	if (data.autotext) populateList('autotextList', data.autotext, '/autotext');
	if (data.wordbook) populateList('wordbookList', data.wordbook, '/wordbook');
	if (data.browsersetting)
		populateList('BrowserSettingsList', data.browsersetting, '/browsersetting');
	if (data.xcu) populateList('XcuList', data.xcu, '/xcu');
}

document.addEventListener('DOMContentLoaded', init);
