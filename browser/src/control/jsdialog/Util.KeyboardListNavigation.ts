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
 * JSDialog.KeyboardListNavigation - handles keyboard-based focus and selection in list-based UI components
 */

declare var JSDialog: any;

function KeyboardListNavigation(
	event: KeyboardEvent,
	currentElement: HTMLElement,
) {
	switch (event.key) {
		case 'ArrowDown':
			moveToFocusableEntry(currentElement, 'next');
			event.preventDefault();
			break;
		case 'ArrowUp':
			moveToFocusableEntry(currentElement, 'previous');
			event.preventDefault();
			break;
		case 'Tab':
			if (event.shiftKey) {
				moveToFocusableEntry(currentElement, 'previous');
				event.preventDefault();
			} else {
				moveToFocusableEntry(currentElement, 'next');
				event.preventDefault();
			}
			break;
		default:
			break;
	}
}
// Helper function to move focus and apply selection class
function moveToFocusableEntry(
	currentElement: HTMLElement,
	direction: 'next' | 'previous',
) {
	// If the current element is focused but not selected, add 'selected' class and return
	if (
		document.activeElement === currentElement &&
		!currentElement.classList.contains('selected') &&
		direction === 'next'
	) {
		currentElement.classList.add('selected');
		return;
	}

	const siblingElement = JSDialog.FindNextFocusableSiblingElement(
		currentElement,
		direction,
	);

	if (siblingElement) {
		(siblingElement as HTMLElement).focus();
		siblingElement.classList.add('selected');
		currentElement.classList.remove('selected');
	}
}

JSDialog.KeyboardListNavigation = function (container: HTMLElement) {
	container.addEventListener('keydown', (event: KeyboardEvent) => {
		const activeElement = document.activeElement as HTMLElement;
		if (!JSDialog.IsTextInputField(activeElement)) {
			KeyboardListNavigation(event, activeElement);
		}
	});
};
