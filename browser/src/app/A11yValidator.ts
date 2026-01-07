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

class A11yValidatorException extends Error {
	static readonly PREFIX: string = 'A11yValidatorException';

	constructor(message: string) {
		super(message);
		this.name = A11yValidatorException.PREFIX;
	}
}

class A11yValidator {
	private checks: Array<(type: string, element: HTMLElement) => void> = [];

	constructor() {
		this.setupChecks();
	}

	private setupChecks(): void {
		this.checks.push(this.checkNativeButtonElement.bind(this));
		this.checks.push(this.checkImageAltAttribute.bind(this));
	}

	checkWidget(type: string, element: HTMLElement): void {
		if (!window.L.Browser.cypressTest) return;

		for (const check of this.checks) {
			try {
				check(type, element);
			} catch (error) {
				if (error instanceof A11yValidatorException)
					console.error(error.message);
				throw error;
			}
		}
	}

	private checkNativeButtonElement(type: string, element: HTMLElement): void {
		if (
			element.tagName !== 'BUTTON' &&
			element.getAttribute('role') === 'button'
		) {
			throw new A11yValidatorException(
				`In '${this.getDialogTitle(element)}': widget of type '${type}' has ${element.tagName} element with role="button". It should use native <button> element instead.`,
			);
		}

		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (child instanceof HTMLElement) {
				this.checkNativeButtonElement(type, child);
			}
		}
	}

	private checkImageAltAttribute(type: string, element: HTMLElement): void {
		const images = element.querySelectorAll('img');

		images.forEach((img, index) => {
			const hasAlt = img.hasAttribute('alt');
			const altValue = img.getAttribute('alt');

			if (!this.isVisible(img)) return; // skip hidden images

			if (!hasAlt)
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}': image element with id: ${img.id} in widget of type '${type}' is missing alt attribute`,
				);

			const parent = img.parentElement;
			const span =
				parent && (parent.querySelector('span.unolabel') as HTMLSpanElement);
			const explicitLabel = span && span.innerText.trim().length > 0;
			const visibleLabel =
				parent && document.querySelector(`label[for^="${parent.id}-"]`);

			const parentHasLabel =
				parent &&
				(parent.hasAttribute('aria-label') ||
					parent.hasAttribute('aria-labelledby') ||
					visibleLabel ||
					explicitLabel);

			if (altValue === '' && parent) {
				const isDecorativeImg = img.classList.contains('ui-decorative-image'); // exclude ui-decorative-image decorative images - they can have empty alt

				if (!parentHasLabel && !isDecorativeImg)
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}': image element with id: ${img.id} inside parent with id: ${parent.id} in widget of type '${type}' has empty alt attribute but parent element lacks label`,
					);
			}

			if (altValue !== '' && parentHasLabel)
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}': image element with id: ${img.id} inside parent with id: ${parent.id} in widget of type '${type}' has non-empty alt attribute but parent element also has label (should not duplicate)`,
				);
		});
	}

	private isVisible(element: HTMLElement): boolean {
		const style = getComputedStyle(element);
		if (style.visibility === 'hidden') return false;

		return element.getClientRects().length > 0;
	}

	private getDialogTitle(element: HTMLElement): string {
		const dialog = element.closest('.ui-dialog');
		if (!dialog) return 'unknown dialog';

		const title = dialog.querySelector('h2.ui-dialog-title');
		return title?.textContent?.trim() || 'untitled dialog';
	}
}

window.app.a11yValidator = new A11yValidator();
window.app.A11yValidatorException = A11yValidatorException;
