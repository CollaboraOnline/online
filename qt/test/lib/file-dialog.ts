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
import * as webview from './webview.js';

/**
 * Open a file from the test fixtures directory via the native Qt file dialog.
 *
 * Triggers .uno:Open, fills the filename field, clicks Open, switches to
 * the new WebView, and waits for the document to finish loading.
 */
export async function openFixture(
	webEngine: WebdriverIO.Browser,
	native: WebdriverIO.Browser,
	fileName: string,
): Promise<void> {
	// Use setTimeout so execute() returns before the modal dialog blocks.
	await webEngine.execute(() => {
		setTimeout(() => {
			window.postMobileMessage('uno .uno:Open');
		}, 100);
	});

	const fileNameField = await native.$(
		'//*[@accessibility-id="QApplication.QFileDialog.fileNameEdit"]',
	);
	await fileNameField.waitForExist({ timeout: 10000 });

	const filePath = join(process.env.CODA_QT_TEST_DOCUMENTS_DIR!, fileName);
	await fileNameField.setValue(filePath);

	const openBtn = await native.$(
		'//*[@accessibility-id="QApplication.QFileDialog.buttonBox.QPushButton"]',
	);
	await openBtn.waitForExist({ timeout: 5000 });
	await openBtn.click();

	await webview.switchToNewWebView(webEngine);

	await (webEngine as any).waitForCondition(
		() =>
			typeof app !== 'undefined' &&
			app.map &&
			app.map._docLoaded === true,
		{
			timeout: 45000,
			timeoutMsg: `Document did not load after opening ${fileName}`,
		},
	);
}
