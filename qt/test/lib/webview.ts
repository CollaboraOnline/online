/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Handles seen before the most recent transition; new handles are detected by absence.
let knownHandles = new Set<string>();

/**
 * Initialize the tracker with all currently live handles. Called from
 * the wdio `before` hook - tests never need to call this.
 */
export async function init(webEngine: WebdriverIO.Browser): Promise<void> {
	const handles = await webEngine.getWindowHandles();
	knownHandles = new Set(handles);
}

/**
 * Wait for coda-qt to open a new WebView, then switch the session to it.
 */
export async function switchToNewWebView(
	webEngine: WebdriverIO.Browser,
	timeoutMs = 30000,
	intervalMs = 300,
): Promise<void> {
	let newHandle: string | null = null;
	let latestHandles: string[] = [];

	await webEngine.waitUntil(
		async () => {
			latestHandles = await webEngine.getWindowHandles();
			newHandle = latestHandles.find((h) => !knownHandles.has(h)) ?? null;
			return newHandle !== null;
		},
		{
			timeout: timeoutMs,
			interval: intervalMs,
			timeoutMsg: `New WebView did not appear within ${timeoutMs}ms`,
		},
	);

	await webEngine.switchToWindow(newHandle!);
	knownHandles = new Set(latestHandles);
}
