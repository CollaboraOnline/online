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
 * JSDialog.KeyboardGridNavigation - handles keyboard-based focus and selection in grid-based UI components
 */

declare var JSDialog: any;

function handleKeyboardNavigation(
	event: KeyboardEvent,
	currentElement: HTMLElement,
	parentContainer: HTMLElement,
	handleSelection?: any,
	builder?: any,
	widgetData?: any,
) {
	switch (event.key) {
		case 'Enter':
		case ' ':
			if (handleSelection && !(currentElement instanceof HTMLSelectElement)) {
				handleSelection(currentElement, builder, widgetData);
				event.preventDefault();
			}
			break;
		case 'ArrowRight':
			moveFocus(parentContainer, currentElement, 'next', 'horizontal');
			event.preventDefault();
			break;
		case 'ArrowLeft':
			moveFocus(parentContainer, currentElement, 'previous', 'horizontal');
			event.preventDefault();
			break;
		case 'ArrowDown':
			moveFocus(parentContainer, currentElement, 'next', 'vertical');
			event.preventDefault();
			break;
		case 'ArrowUp':
			moveFocus(parentContainer, currentElement, 'previous', 'vertical');
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
			if (
				!focusableElements.find(
					(el) =>
						getRowColumn(el)[0] === currentRow &&
						getRowColumn(el)[1] === targetColumn,
				)
			) {
				targetColumn = 0;
			}
		} else {
			targetColumn--;
			if (targetColumn < 0) {
				targetColumn =
					focusableElements.filter((el) => getRowColumn(el)[0] === currentRow)
						.length - 1;
			}
		}
	} else if (axis === 'vertical') {
		if (direction === 'next') {
			targetRow++;
		} else {
			targetRow--;
		}
	}

	const targetElement = focusableElements.find(
		(el) =>
			getRowColumn(el)[0] === targetRow && getRowColumn(el)[1] === targetColumn,
	);

	if (targetElement) {
		targetElement.focus();
	} else {
		// Determine the element to pass to FindFocusableElement based on axis and direction
		const potentialCurrentElement =
			axis === 'vertical' ? parentContainer : currentElement;
		// if vertical or
		const nextElement =
			direction === 'next'
				? JSDialog.FindFocusableElement(
						potentialCurrentElement.nextElementSibling,
						'next',
					)
				: JSDialog.FindFocusableElement(
						potentialCurrentElement.previousElementSibling,
						'previous',
					);
		if (nextElement) {
			nextElement.focus();
		}
	}
}

function getRowColumn(element: HTMLElement): [number, number] {
	const index = element.getAttribute('index');
	if (!index) return [-1, -1]; // we will never have this kind of index this is why we are pssing nagative values here
	const [row, column] = index.split(':').map(Number);
	return [row, column];
}

JSDialog.KeyboardGridNavigation = function (
	container: HTMLElement,
	selectionHandler?: any,
	builder?: any,
	widgetData?: any,
) {
	container.addEventListener('keydown', (event: KeyboardEvent) => {
		const activeElement = document.activeElement as HTMLElement;
		if (!JSDialog.IsTextInputField(activeElement)) {
			handleKeyboardNavigation(
				event,
				activeElement,
				activeElement.parentElement,
				selectionHandler,
				builder,
				widgetData,
			);
		}
	});
};
