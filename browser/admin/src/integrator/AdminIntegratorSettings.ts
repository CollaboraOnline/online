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
}

interface SharedConfigItem {
	stamp: string;
	uri: string;
}

interface SharedConfigData {
	kind: 'shared';
	autotext: SharedConfigItem[];
	wordbook: SharedConfigItem[];
}

const API_ENDPOINTS = {
	uploadSettings: window.enableDebug
		? '/wopi/settings/upload'
		: '/browser/dist/upload-settings',
	fetchSharedConfig: '/browser/dist/fetch-shared-config',
};

function init(): void {
	initWindowVariables();
	bindEventListeners();
	void fetchAndPopulateSharedConfigs();
}

function bindEventListeners(): void {
	const uploadAutotextButton = document.getElementById('uploadAutotextButton');
	if (uploadAutotextButton) {
		uploadAutotextButton.addEventListener('click', () => {
			console.log('Upload Autotext clicked.');
			uploadFile('/settings/systemconfig/autotext/');
		});
	}

	const uploadWordbookButton = document.getElementById('uploadWordbookButton');
	if (uploadWordbookButton) {
		uploadWordbookButton.addEventListener('click', () => {
			console.log('Upload Wordbook clicked.');
			uploadFile('/settings/systemconfig/wordbook/');
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
}

async function uploadFile(filePath: string): Promise<void> {
	// TODO: use wopiSettingBaseUrl for request url..
	const fileInput = document.getElementById(
		'dictionaryFile',
	) as HTMLInputElement | null;
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

		console.log('Shared config file: ', window.wopiSettingBaseUrl);
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

	if (!window.accessToken) {
		console.error('Access token is missing in initial variables.');
		return;
	}

	const formData = new FormData();
	formData.append('sharedConfigUrl', window.wopiSettingBaseUrl);
	formData.append('accessToken', window.accessToken);

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

		const data: SharedConfigData = await response.json();
		populateSharedConfigUI(data);
		console.log('Shared config data: ', data);
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

function populateList(listId: string, items: SharedConfigItem[]): void {
	const listEl = document.getElementById(listId);
	if (!listEl) return;

	listEl.innerHTML = '';

	items.forEach((item) => {
		const li = document.createElement('li');
		li.textContent = getFilename(item.uri);
		listEl.appendChild(li);
	});
}

function populateSharedConfigUI(data: SharedConfigData): void {
	populateList('autotextList', data.autotext);
	populateList('wordbookList', data.wordbook);
}

document.addEventListener('DOMContentLoaded', init);
