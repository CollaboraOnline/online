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
}

interface ConfigItem {
	stamp: string;
	uri: string;
}

interface ConfigData {
	kind: 'shared' | 'user';
	autotext: ConfigItem[] | null;
	wordbook: ConfigItem[] | null;
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
	bindEventListeners();
	void fetchAndPopulateSharedConfigs();
}

function bindEventListeners(): void {
	const uploadAutotextButton = document.getElementById('uploadAutotextButton');
	const uploadAutotextInput = document.getElementById('autotextFile');
	if (uploadAutotextButton && uploadAutotextInput) {
		uploadAutotextButton.addEventListener('click', () => {
			console.debug('Upload Autotext clicked.');
			uploadAutotextInput.click();
		});
		uploadAutotextInput.addEventListener('change', () => {
			uploadFile(PATH.autoTextUpload());
		});
	}

	const uploadWordbookButton = document.getElementById('uploadWordbookButton');
	const uploadWordbookInput = document.getElementById('dictionaryFile');
	if (uploadWordbookButton && uploadWordbookInput) {
		uploadWordbookButton.addEventListener('click', () => {
			console.debug('Upload Wordbook clicked.');
			uploadWordbookInput.click();
		});

		uploadWordbookInput.addEventListener('change', () => {
			uploadFile(PATH.wordBookUpload());
		});
	}
}

function initWindowVariables(): void {
	const element = document.getElementById('initial-variables');
	if (!element) return;

	window.accessToken = element.dataset.accessToken;
	window.accessTokenTTL = element.dataset.accessTokenTtl;
	window.enableDebug = element.dataset.enableDebug;
	window.wopiSettingBaseUrl = element.dataset.wopiSettingBaseUrl;
	window.iframeType = element.dataset.iframeType;

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

async function uploadFile(filePath: string): Promise<void> {
	let fileInput: HTMLInputElement | null = null;
	if (filePath.includes('wordbook')) {
		fileInput = document.getElementById(
			'dictionaryFile',
		) as HTMLInputElement | null;
	} else if (filePath.includes('autotext')) {
		fileInput = document.getElementById(
			'autotextFile',
		) as HTMLInputElement | null;
	}

	const fileStatus = document.getElementById(
		'fileStatus',
	) as HTMLParagraphElement | null;
	if (!fileInput || !fileStatus) {
		console.error('Required DOM elements are missing.');
		return;
	}

	if (!fileInput.files || fileInput.files.length === 0) {
		fileStatus.textContent = 'No file selected for upload.';
		return;
	}
	console.debug('filepath for', window.iframeType, filePath);

	const file = fileInput.files[0];
	const formData = new FormData();
	formData.append('file', file);
	formData.append('filePath', filePath);
	if (window.wopiSettingBaseUrl) {
		formData.append('wopiSettingBaseUrl', window.wopiSettingBaseUrl);
	}

	fileStatus.textContent = `Uploading "${file.name}"...`;

	try {
		const apiUrl = API_ENDPOINTS.uploadSettings;

		console.debug('Shared config file: ', window.wopiSettingBaseUrl);
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

		fileStatus.textContent = `File "${file.name}" uploaded successfully!`;
		await fetchAndPopulateSharedConfigs();
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		fileStatus.textContent = `Error: ${message}`;
	} finally {
		fileInput.value = '';
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
		const li = document.createElement('li');
		const fileName = getFilename(item.uri);

		// Create the "Download" button
		const downloadBtn = document.createElement('button');
		downloadBtn.textContent = 'Download';
		downloadBtn.classList.add('download-button');

		downloadBtn.addEventListener('click', () => {
			window.open(item.uri, '_blank');
		});

		// Create the "Delete" button
		const deleteBtn = document.createElement('button');
		deleteBtn.textContent = 'Delete';
		deleteBtn.classList.add('delete-button');

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

				// On success - remove the list item from the UI
				listEl.removeChild(li);
			} catch (error: unknown) {
				console.error('Error deleting file:', error);
			}
		});

		li.textContent = `${fileName} | `;
		li.appendChild(downloadBtn);
		li.appendChild(document.createTextNode(' | '));
		li.appendChild(deleteBtn);

		listEl.appendChild(li);
	});
}

function populateSharedConfigUI(data: ConfigData): void {
	if (data.autotext) populateList('autotextList', data.autotext, '/autotext');
	if (data.wordbook) populateList('wordbookList', data.wordbook, '/wordbook');
}

document.addEventListener('DOMContentLoaded', init);
