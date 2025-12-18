/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * JSDialog.KeyboardRadioGroupNavigation - handles keyboard navigation for radiogroup based UI components
 */

declare var JSDialog: any;

function KeyboardRadioGroupNavigation(
	event: KeyboardEvent,
	currentElement: HTMLElement,
) {
	switch (event.key) {
		case 'ArrowDown':
		case 'ArrowRight':
			moveToNextRadio(currentElement, 'next');
			event.preventDefault();
			event.stopPropagation();
			break;
		case 'ArrowUp':
		case 'ArrowLeft':
			moveToNextRadio(currentElement, 'previous');
			event.preventDefault();
			event.stopPropagation();
			break;
		default:
			break;
	}
}

function moveToNextRadio(
	currentElement: HTMLElement,
	direction: 'next' | 'previous',
) {
	const siblingElement = JSDialog.FindNextFocusableSiblingElement(
		currentElement,
		direction,
	);

	if (siblingElement) {
		currentElement.setAttribute('aria-checked', 'false');
		currentElement.setAttribute('tabindex', '-1');
		currentElement.classList.remove('selected');

		siblingElement.setAttribute('aria-checked', 'true');
		siblingElement.setAttribute('tabindex', '0');
		siblingElement.classList.add('selected');
		(siblingElement as HTMLElement).focus();
	}
}

JSDialog.KeyboardRadioGroupNavigation = function (container: HTMLElement) {
	container.addEventListener('keydown', (event: KeyboardEvent) => {
		const activeElement = document.activeElement as HTMLElement;
		if (!JSDialog.IsTextInputField(activeElement)) {
			KeyboardRadioGroupNavigation(event, activeElement);
		}
	});
};
