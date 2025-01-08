/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable */

const uploadBtn = document.getElementById('uploadButton');
if (uploadBtn) {
	uploadBtn.addEventListener('click', uploadFile);
}

async function uploadFile() {
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

	const accessToken = '%ACCESS_TOKEN%';
	const apiUrl = '/browser/dist/upload-settings'; // COOL backend endpoint

	if (!fileInput.files || fileInput.files.length === 0) {
		fileStatus.textContent = 'No file selected for upload.';
		return;
	}

	const file = fileInput.files[0];
	const formData = new FormData();
	formData.append('file', file);

	fileStatus.textContent = `Uploading "${file.name}"...`;

	try {
		// Send the file to the coolwsd backend
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Upload failed: ${response.statusText}`);
		}

		fileStatus.textContent = `File "${file.name}" uploaded successfully!`;
	} catch (error) {
		fileStatus.textContent = `Error: ${error.message}`;
	}

	fileInput.value = '';
}
