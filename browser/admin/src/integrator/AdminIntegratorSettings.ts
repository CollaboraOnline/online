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
	enableDebug?: string;
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
	fetchSharedConfig: '/browser/dist/fetch-shared-config',
	deleteSharedConfig: '/browser/dist/delete-shared-config',
};

const PATH = {
	autoTextUpload: () => settingConfigBasePath() + '/autotext/',
	wordBookUpload: () => settingConfigBasePath() + '/wordbook/',
	browserSettingsUpload: () => settingConfigBasePath() + '/browsersetting/',
};

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
	window.enableDebug = element.dataset.enableDebug;
	window.wopiSettingBaseUrl = element.dataset.wopiSettingBaseUrl;
	window.iframeType = element.dataset.iframeType;
	window.cssVars = element.dataset.cssVars;
	if (window.cssVars) {
		window.cssVars = atob(window.cssVars);
		console.log('cssVars: ' + window.cssVars);
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

				// On success - remove li
				listEl.removeChild(li);
			} catch (error: unknown) {
				console.error('Error deleting file:', error);
			}
		});

		extraActionsDiv.append(downloadBtn, deleteBtn);

		listItemDiv.append(anchor, extraActionsDiv);
		li.appendChild(listItemDiv);
		listEl.appendChild(li);
	});
}

function populateSharedConfigUI(data: ConfigData): void {
	// todo: dynamically generate this list too from configSections
	if (data.autotext) populateList('autotextList', data.autotext, '/autotext');
	if (data.wordbook) populateList('wordbookList', data.wordbook, '/wordbook');
	if (data.browsersetting && data.browsersetting.length > 0) {
		const button = document.getElementById(
			'uploadBrowserSettingsButton',
		) as HTMLButtonElement | null;
		if (button) {
			button.disabled = true;
		}

		populateList('BrowserSettingsList', data.browsersetting, '/browsersetting');
	}
}

document.addEventListener('DOMContentLoaded', init);
