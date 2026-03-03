/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let currentHandle = null;

/**
 * Initialize the tracker with the current window handle. Called from
 * the wdio `before` hook - tests never need to call this.
 */
export async function init(webEngine) {
	currentHandle = await webEngine.getWindowHandle();
}

/**
 * Wait for a new WebView to replace the current one, then switch to it.
 * coda-qt destroys and recreates the WebView when transitioning between
 * views (e.g. backstage -> document editor).
 *
 * Usage in tests:
 *   await browser.webEngine.execute(() => { ... trigger transition ... });
 *   await webview.reconnect(browser.webEngine);
 */
export async function reconnect(
	webEngine,
	timeoutMs = 30000,
	intervalMs = 300,
) {
	let newHandle = null;

	await webEngine.waitUntil(
		async () => {
			const handles = await webEngine.getWindowHandles();
			newHandle = handles.find((h) => h !== currentHandle) ?? null;
			return newHandle !== null;
		},
		{
			timeout: timeoutMs,
			interval: intervalMs,
			timeoutMsg: `New WebView did not become available within ${timeoutMs}ms`,
		},
	);

	await webEngine.switchToWindow(newHandle);
	currentHandle = newHandle;
}
