/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { join } from 'path';
import * as webview from '../lib/webview.js';

describe('Open existing file', () => {
	it('should open a .odt file via the native file dialog', async function () {
		// Send the UNO Open command via the bridge. Use setTimeout so
		// execute() returns before the modal dialog blocks the WebView.
		await browser.webEngine.execute(() => {
			setTimeout(() => {
				window.postMobileMessage('uno .uno:Open');
			}, 100);
		});

		// Wait for the filename field; accessibility-id is locale-stable.
		const fileNameField = await browser.native.$(
			'//*[@accessibility-id="QApplication.QFileDialog.fileNameEdit"]',
		);
		await fileNameField.waitForExist({ timeout: 10000 });

		const filePath = join(process.env.CODA_QT_TEST_DOCUMENTS_DIR!, 'simple.odt');
		await fileNameField.setValue(filePath);

		// First QPushButton is "Open"
		const openBtn = await browser.native.$(
			'//*[@accessibility-id="QApplication.QFileDialog.buttonBox.QPushButton"]',
		);
		await openBtn.waitForExist({ timeout: 5000 });
		await openBtn.click();

		await webview.switchToNewWebView(browser.webEngine);

		// Use _docLoaded; opening a file may not auto-focus the cursor.
		await browser.webEngine.waitForCondition(
			() =>
				typeof app !== 'undefined' && app.map && app.map._docLoaded === true,
			{
				timeout: 45000,
				timeoutMsg: 'Document editor did not load after opening file',
			},
		);

		const state = await browser.webEngine.execute(() => ({
			docLoaded: app.map._docLoaded,
			docType: app.map.getDocType(),
		}));

		expect(state.docLoaded).toBe(true);
		expect(state.docType).toBe('text');
	});
});
