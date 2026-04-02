/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Multiremote browser shape exposed by WDIO in every spec file.
declare const browser: {
	webEngine: WebdriverIO.Browser & {
		waitForCondition(
			predicate: () => boolean,
			opts?: {
				timeout?: number;
				interval?: number;
				timeoutMsg?: string;
			},
		): Promise<boolean>;
	};
	native: WebdriverIO.Browser;
};

// Globals available inside browser.execute() callbacks (browser-side).
interface Window {
	postMobileMessage(msg: string): void;
}
declare const app: {
	map: {
		_docLoaded: boolean;
		getDocType(): string;
		backstageView?: {
			show(): void;
			hide(): void;
			toggle(): void;
		};
	};
	dispatcher: {
		dispatch(action: string): void;
	};
	activeDocument?: {
		activeLayout?: {
			type: string;
			documentRectangles?: Array<unknown>;
			viewedRectangle?: { pWidth: number; pHeight: number };
		};
	};
	layoutingService: {
		hasTasksPending(): boolean;
	};
};
