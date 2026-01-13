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
		// Fix prototype chain for TypeScript extending built-in classes
		Object.setPrototypeOf(this, A11yValidatorException.prototype);
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
		for (const check of this.checks) {
			try {
				check(type, element);
			} catch (error) {
				if (error instanceof A11yValidatorException) console.error(error);
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
				`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': widget of type '${type}' has ${element.tagName} element with role="button". It should use native <button> element instead.`,
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

			if (!hasAlt) {
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' is missing alt attribute`,
				);
			}

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

				if (!parentHasLabel && !isDecorativeImg) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' has empty alt attribute but parent element lacks label`,
					);
				}
			}

			if (altValue !== '' && parentHasLabel) {
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' has non-empty alt attribute but parent element also has label (should not duplicate)`,
				);
			}
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

	private getElementPath(element: HTMLElement): string {
		const ids: string[] = [];
		let current: HTMLElement | null = element;
		const dialog = element.closest('.ui-dialog');

		while (current && current !== dialog) {
			if (current.id) {
				ids.unshift(current.id);
			}
			current = current.parentElement;
		}

		return ids.length > 0 ? ids.join(' > ') : '(no ids in path)';
	}

	validateDialog(dialogElement: HTMLElement): void {
		const content = dialogElement.querySelector('.ui-dialog-content');

		// Find all widgets in the dialog that have a data-type attribute
		const widgets = dialogElement.querySelectorAll('[data-widgettype]');
		let errorCount = 0;

		widgets.forEach((widget) => {
			if (widget instanceof HTMLElement) {
				const widgetType = widget.getAttribute('data-widgettype') || 'unknown';
				try {
					this.checkWidget(widgetType, widget);
				} catch (error) {
					errorCount++;
					// Error already logged in checkWidget
				}
			}
		});

		// Also validate the dialog content container itself
		if (content instanceof HTMLElement) {
			try {
				this.checkWidget('dialog-content', content);
			} catch (error) {
				errorCount++;
			}
		}

		if (errorCount === 0) {
			console.error('A11yValidator: dialog passed all checks');
		} else {
			console.error(
				`A11yValidator: dialog has ${errorCount} accessibility issues`,
			);
		}
	}

	validateAllOpenDialogs(): void {
		const jsdialog = app.map?.jsdialog;
		if (!jsdialog || !jsdialog.dialogs) {
			console.error('A11yValidator: no jsdialog manager found');
			return;
		}

		const dialogIds = Object.keys(jsdialog.dialogs);
		if (dialogIds.length === 0) {
			console.error('A11yValidator: no open dialogs to validate');
			return;
		}

		for (const dialogId of dialogIds) {
			const dialogInfo = jsdialog.dialogs[dialogId];
			if (dialogInfo && dialogInfo.container) {
				this.validateDialog(dialogInfo.container);
			}
		}
	}
}

window.app.a11yValidator = new A11yValidator();
window.app.A11yValidatorException = A11yValidatorException;
