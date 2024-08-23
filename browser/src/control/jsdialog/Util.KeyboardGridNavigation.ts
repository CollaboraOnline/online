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
 * JSDialog.ScrollableBar - helper for creating toolbars with scrolling left/right
 */

declare var JSDialog: any;

// Utility function to handle keyboard navigation
function handleKeyboardNavigation(
	event: KeyboardEvent,
	currentElement: HTMLElement,
	parentContainer: HTMLElement,
	handleSelection?: any,
	builder?: any,
	widgetData?: any,
	palette?: any,
) {
	switch (event.key) {
		case 'Enter':
		case ' ':
			if (handleSelection) {
				handleSelection(currentElement, builder, widgetData, palette);
				event.preventDefault();
			}
			break;
		case 'ArrowRight':
			moveFocus(
				parentContainer,
				currentElement,
				'next',
				'horizontal',
				currentElement.nextElementSibling,
			);
			event.preventDefault();
			break;
		case 'ArrowLeft':
			moveFocus(
				parentContainer,
				currentElement,
				'previous',
				'horizontal',
				currentElement.previousElementSibling,
			);
			event.preventDefault();
			break;
		case 'ArrowDown':
			moveFocus(
				parentContainer,
				currentElement,
				'next',
				'vertical',
				parentContainer.nextElementSibling,
			);
			event.preventDefault();
			break;
		case 'ArrowUp':
			moveFocus(
				parentContainer,
				currentElement,
				'previous',
				'vertical',
				parentContainer.previousElementSibling,
			);
			event.preventDefault();
			break;
		default:
			break;
	}
}

function moveFocus(
	parentContainer: HTMLElement,
	currentElement: HTMLElement,
	direction: 'next' | 'previous',
	axis: 'horizontal' | 'vertical',
	nextElement?: Element,
) {
	const focusableElements = Array.from(
		JSDialog.GetFocusableElements(parentContainer),
	) as HTMLElement[];

	const [currentRow, currentColumn] = getRowColumn(currentElement);

	let targetRow = currentRow;
	let targetColumn = currentColumn;

	if (axis === 'horizontal') {
		if (direction === 'next') {
			targetColumn++;
			// If it's the last element in the row, cycle back to the first in the same row
			if (
				!focusableElements.find((el) => {
					const [row, column] = getRowColumn(el);
					return row === currentRow && column === targetColumn;
				})
			) {
				targetColumn = 0; // Start from the first column
			}
		} else {
			targetColumn--;
			// If it's the first element in the row and trying to move previous, cycle to the last in the same row
			if (targetColumn < 0) {
				targetColumn =
					focusableElements.filter((el) => {
						const [row] = getRowColumn(el);
						return row === currentRow;
					}).length - 1; // Move to the last column in the same row
			}
		}
	} else if (axis === 'vertical') {
		if (direction === 'next') {
			targetRow++;
		} else {
			targetRow--;
		}
	}

	// Find the target element based on the calculated row and column
	const targetElement = focusableElements.find((el) => {
		const [row, column] = getRowColumn(el);
		return row === targetRow && column === targetColumn;
	});

	if (!targetElement) {
		if (direction === 'next') {
			// Start from the next sibling of the parent container
			const nextFocusableElement = JSDialog.FindFocusableElement(
				nextElement as HTMLElement,
				'next',
			);
			if (nextFocusableElement) {
				nextFocusableElement.focus();
			}
		} else if (direction === 'previous') {
			// Start from the previous sibling of the parent container
			const previousFocusableElement = JSDialog.FindFocusableElement(
				nextElement as HTMLElement,
				'previous',
			);
			if (previousFocusableElement) {
				previousFocusableElement.focus();
			}
		}
		return;
	}

	targetElement.focus();
}

function getRowColumn(element: HTMLElement): [number, number] {
	const index = element.getAttribute('index');
	if (!index) return [-1, -1]; // we will never have this kind of index this is why we are pssing nagative values here
	const [row, column] = index.split(':').map(Number);
	return [row, column];
}

JSDialog.MoveFocus = moveFocus;
