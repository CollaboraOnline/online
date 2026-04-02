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

// Regression test for https://github.com/CollaboraOnline/online/issues/15291
//
// When BackstageView is shown while multi-page view is active, hiding
// #document-container triggers ResizeObservers that shrink the canvas to
// zero. ViewLayoutMultiPage.refreshVisibleAreaRectangle() then enters an
// infinite retry loop (no page rectangles intersect a zero-sized viewport),
// making the UI completely unresponsive.
describe('Multi-page view backstage (issue #15291)', () => {
	it('should not freeze when opening backstage in multi-page view', async function () {
		// Open the multi-page fixture via the native file dialog.
		await browser.webEngine.execute(() => {
			setTimeout(() => {
				window.postMobileMessage('uno .uno:Open');
			}, 100);
		});

		const fileNameField = await browser.native.$(
			'//*[@accessibility-id="QApplication.QFileDialog.fileNameEdit"]',
		);
		await fileNameField.waitForExist({ timeout: 10000 });

		const filePath = join(
			process.env.CODA_QT_TEST_DOCUMENTS_DIR!,
			'scrolling.odt',
		);
		await fileNameField.setValue(filePath);

		const openBtn = await browser.native.$(
			'//*[@accessibility-id="QApplication.QFileDialog.buttonBox.QPushButton"]',
		);
		await openBtn.waitForExist({ timeout: 5000 });
		await openBtn.click();

		await webview.switchToNewWebView(browser.webEngine);

		await browser.webEngine.waitForCondition(
			() =>
				typeof app !== 'undefined' &&
				app.map &&
				app.map._docLoaded === true,
			{
				timeout: 45000,
				timeoutMsg: 'Document did not load',
			},
		);

		// Enable multi-page view.
		await browser.webEngine.execute(() => {
			app.dispatcher.dispatch('multipageview');
		});

		// Wait for multi-page view to be active with multiple pages.
		await browser.webEngine.waitForCondition(
			() => {
				const layout = app.activeDocument?.activeLayout;
				return !!(
					layout?.type === 'ViewLayoutMultiPage' &&
					layout.documentRectangles &&
					layout.documentRectangles.length > 1
				);
			},
			{
				timeout: 15000,
				timeoutMsg:
					'Multi-page view did not activate with multiple pages',
			},
		);

		// Wait for layout tasks to settle before triggering backstage.
		await browser.webEngine.waitForCondition(
			() => !app.layoutingService.hasTasksPending(),
			{ timeout: 10000, timeoutMsg: 'Layout tasks did not settle' },
		);

		// Show the backstage view (same as clicking the File tab).
		// Without the fix this causes an infinite layout task loop.
		await browser.webEngine.execute(() => {
			app.map.backstageView!.show();
		});

		// Verify layout tasks drain. Without the fix, hasTasksPending()
		// stays true forever due to the infinite retry loop in
		// refreshVisibleAreaRectangle().
		await browser.webEngine.waitForCondition(
			() => !app.layoutingService.hasTasksPending(),
			{
				timeout: 5000,
				timeoutMsg:
					'Layout tasks did not drain - infinite loop detected (issue #15291)',
			},
		);

		// Close the backstage.
		await browser.webEngine.execute(() => {
			app.map.backstageView!.hide();
		});

		// Verify multi-page view recovered after backstage is closed.
		await browser.webEngine.waitForCondition(
			() => {
				const container = document.getElementById(
					'document-container',
				);
				if (!container || container.classList.contains('hidden'))
					return false;

				const layout = app.activeDocument?.activeLayout;
				if (!layout || layout.type !== 'ViewLayoutMultiPage')
					return false;

				const vr = layout.viewedRectangle;
				return !!(vr && vr.pWidth > 0 && vr.pHeight > 0);
			},
			{
				timeout: 15000,
				timeoutMsg:
					'Multi-page view did not recover after backstage',
			},
		);
	});
});
