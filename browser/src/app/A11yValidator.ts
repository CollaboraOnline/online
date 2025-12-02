/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class A11yValidator {
	private checks: Array<(type: string, element: HTMLElement) => void> = [];

	constructor() {
		this.setupChecks();
	}

	private setupChecks(): void {
		this.checks.push(this.checkNativeButtonElement.bind(this));
	}

	checkWidget(type: string, element: HTMLElement): void {
		if (!window.L.Browser.cypressTest) return;

		for (const check of this.checks) {
			try {
				check(type, element);
			} catch (error) {
				console.error(`A11y check failed for ${type}:`, error);
				throw error;
			}
		}
	}

	private checkNativeButtonElement(type: string, element: HTMLElement): void {
		if (
			element.tagName !== 'BUTTON' &&
			element.getAttribute('role') === 'button'
		) {
			throw `For widget of type '${type}' found ${element.tagName} element with role="button". it should use native <button> element instead.`;
		}

		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (child instanceof HTMLElement) {
				this.checkNativeButtonElement(type, child);
			}
		}
	}
}

window.app.a11yValidator = new A11yValidator();
