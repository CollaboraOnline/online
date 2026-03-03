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
	private _directlyValidatedElements: Set<Element> | null = null;

	constructor() {
		this.setupChecks();
	}

	private setupChecks(): void {
		this.checks.push(this.checkNativeButtonElement.bind(this));
		this.checks.push(this.checkImageAltAttribute.bind(this));
		this.checks.push(this.checkLabelElement.bind(this));
		this.checks.push(this.checkElementHasLabel.bind(this));
		this.checks.push(this.checkAriaControls.bind(this));
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
			if (this.shouldCheckChild(child)) {
				this.checkNativeButtonElement(type, child as HTMLElement);
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
				parent && document.querySelector(`label[for="${parent.id}"]`);

			const parentHasLabel =
				parent &&
				(parent.hasAttribute('aria-label') ||
					parent.hasAttribute('aria-labelledby') ||
					visibleLabel ||
					explicitLabel);

			const isFocusable = img.tabIndex === 0;

			if (altValue === '' && parent) {
				const isDecorativeImg = img.classList.contains('ui-decorative-image'); // exclude ui-decorative-image decorative images - they can have empty alt

				if (isFocusable) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': focusable image in widget of type '${type}' has empty alt attribute (screen readers need alt text for focusable images) or make it decorative by removing tabIndex`,
					);
				}

				if (!parentHasLabel && !isDecorativeImg) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' has empty alt attribute but parent element lacks label`,
					);
				}
			}

			if (altValue !== '' && parentHasLabel && !isFocusable) {
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' has non-empty alt attribute but parent element also has label (should not duplicate)`,
				);
			}
		});
	}

	private checkElementHasLabel(type: string, element: HTMLElement): void {
		if (element.hasAttribute('aria-labelledby')) {
			const labelledbyId = element.getAttribute('aria-labelledby') as string;

			const referencedElement = document.getElementById(labelledbyId);

			if (!referencedElement) {
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element in widget of type '${type}' has aria-labelledby attribute pointing to non-existing element with id: '${labelledbyId}'`,
				);
			} else {
				const labelHasHtmlFor =
					referencedElement.tagName === 'LABEL' &&
					(referencedElement as HTMLLabelElement).htmlFor;

				const htmlForPointsToThisElement =
					labelHasHtmlFor &&
					(referencedElement as HTMLLabelElement).htmlFor === element.id;

				if (htmlForPointsToThisElement) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element in widget of type '${type}' has aria-labelledby attribute pointing to label element with id: '${labelledbyId}', but that label also has htmlFor attribute pointing to this element. Should not duplicate labelling.`,
					);
				}
			}
		} else {
			const visibleLabel = document.querySelector(`label[for="${element.id}"]`);
			if (!visibleLabel) {
				const ariaLabel = element.getAttribute('aria-label') ?? '';
				const hasAriaLabel = ariaLabel.trim() !== '';

				if (
					JSDialog.GetFormControlTypesInCO().has(element.tagName) &&
					!hasAriaLabel
				) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element in widget of type '${type}' is missing label: it should have either <label>, aria-labelledby or aria-label attribute.`,
					);
				}
			}
		}

		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (this.shouldCheckChild(child)) {
				this.checkElementHasLabel(type, child as HTMLElement);
			}
		}
	}

	private checkLabelElement(type: string, element: HTMLElement): void {
		if (element.tagName === 'LABEL') {
			const htmlFor = (element as HTMLLabelElement).htmlFor?.trim();
			if (htmlFor) {
				const referencedElement = document.getElementById(htmlFor);
				if (!referencedElement) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' has htmlFor attribute pointing to non-existing element with id '${htmlFor}'`,
					);
				} else if (
					!JSDialog.GetFormControlTypesInCO().has(referencedElement.tagName)
				) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' references non-labelable element <${referencedElement.tagName.toLowerCase()}> via htmlFor attribute. Try using aria-labelledby on the referenced element instead.`,
					);
				} else if (
					referencedElement.hasAttribute('aria-labelledby') ||
					referencedElement.hasAttribute('aria-label')
				) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' is associated with element with id: '${htmlFor}' via htmlFor, but that element also has aria-label or aria-labelledby attribute. Should not duplicate labelling.`,
					);
				}
			} else {
				const referencedElement = document.querySelector(
					`[aria-labelledby="${element.id}"]`,
				);
				if (!referencedElement) {
					throw new A11yValidatorException(
						`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' is not associated with any element via htmlFor or aria-labelledby. Should this element really be a label? If it just represent static text then try converting it into a <span> element instead.`,
					);
				}
			}
		}
	}

	// TODO: there are some elements on which aria-controls only added
	// when the relevant element exist in DOM. Need to handle that case as well.
	private checkAriaControls(type: string, element: HTMLElement): void {
		const controlledElementId = element.getAttribute('aria-controls') || '';
		if (controlledElementId.trim() !== '') {
			const referencedElement = document.getElementById(controlledElementId);

			if (!referencedElement) {
				throw new A11yValidatorException(
					`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element is widget of type '${type}' has aria-control attribute but mentioned element does not exist in DOM. Only add this attribute when mentioned element exist in DOM.`,
				);
			}
		}

		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (this.shouldCheckChild(child)) {
				this.checkAriaControls(type, child as HTMLElement);
			}
		}
	}

	private shouldCheckChild(child: Element): boolean {
		return (
			child instanceof HTMLElement &&
			!this._directlyValidatedElements?.has(child)
		);
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

	validateContainer(
		dialogElement: HTMLElement,
		extraElement?: HTMLElement,
	): number {
		// Find all widgets in the dialog that have an id
		const widgets = dialogElement.querySelectorAll('[id]');
		let errorCount = 0;

		// Build a set of widget elements so that the recursive checks
		// (checkNativeButtonElement, checkElementHasLabel) can skip
		// children that will be validated individually.  Without this,
		// every parent re-walks all descendants → O(n²).
		this._directlyValidatedElements = new Set(Array.from(widgets));

		widgets.forEach((widget) => {
			if (widget instanceof HTMLElement) {
				const widgetType = widget.getAttribute('id') || 'unknown';
				try {
					this.checkWidget(widgetType, widget);
				} catch (error) {
					errorCount++;
					// Error already logged in checkWidget
				}
			}
		});

		if (extraElement && !this._directlyValidatedElements.has(extraElement)) {
			try {
				this.checkWidget('dialog-content', extraElement);
			} catch (error) {
				errorCount++;
			}
		}

		this._directlyValidatedElements = null;
		return errorCount;
	}

	validateDialog(dialogElement: HTMLElement): void {
		const content = dialogElement.querySelector('.ui-dialog-content');

		const errorCount = this.validateContainer(
			dialogElement,
			content instanceof HTMLElement ? content : undefined,
		);

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

	validateSidebar(): void {
		const currentSidebar = app.map?.sidebar;
		if (!currentSidebar) {
			console.error('A11yValidator: no open sidebar to validate');
			return;
		}

		const errorCount = this.validateContainer(currentSidebar.container);

		if (errorCount === 0) {
			console.error('A11yValidator: sidebar passed all checks');
		} else {
			console.error(
				`A11yValidator: sidebar has ${errorCount} accessibility issues`,
			);
		}
	}

	validateNotebookbar(): void {
		const notebookbar = app.map?.uiManager?.notebookbar;
		if (!notebookbar) {
			console.error('A11yValidator: no notebookbar to validate');
			return;
		}

		const errorCount = this.validateContainer(notebookbar.container);

		if (errorCount === 0) {
			console.error('A11yValidator: notebookbar passed all checks');
		} else {
			console.error(
				`A11yValidator: notebookbar has ${errorCount} accessibility issues`,
			);
		}
	}
}

window.app.a11yValidator = new A11yValidator();
window.app.A11yValidatorException = A11yValidatorException;
