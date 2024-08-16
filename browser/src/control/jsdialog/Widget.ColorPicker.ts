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
 * JSDialog.ColorPicker - color picker for desktop
 */

declare var JSDialog: any;

interface ColorPaletteWidgetData {
	id: string;
	command: string;
}

type ColorItem = string;
type CoreColorPalette = Array<Array<{ Value: ColorItem }>>;
type ColorPalette = Array<Array<ColorItem>>;

interface Window {
	prefs: any;
}

function getCurrentPaletteName(): string {
	const palette = window.prefs.get('colorPalette');

	if (
		palette === undefined ||
		window.app.colorPalettes[palette] === undefined
	) {
		return 'StandardColors';
	}

	return palette;
}

// TODO: we don't need to use that format now - simplify?
function toW2Palette(corePalette: CoreColorPalette): ColorPalette {
	const pal: ColorPalette = [];

	if (!corePalette) return pal;

	for (let i = 0; i < corePalette.length; i++) {
		const row = [];
		for (let j = 0; j < corePalette[i].length; j++) {
			row.push(String(corePalette[i][j].Value).toUpperCase());
		}
		pal.push(row);
	}
	return pal;
}

function generatePalette(paletteName: string) {
	const colorPalette = toW2Palette(
		window.app.colorPalettes[paletteName].colors,
	);
	const customColorRow = window.prefs.get('customColor');
	const recentRow = window.prefs.get('recentColor');

	if (customColorRow !== undefined) {
		colorPalette.push(JSON.parse(customColorRow));
	} else {
		colorPalette.push(['F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2']); // custom colors (up to 4)
	}

	if (recentRow !== undefined) {
		colorPalette.push(JSON.parse(recentRow));
	} else {
		colorPalette.push([
			'F2F2F2',
			'F2F2F2',
			'F2F2F2',
			'F2F2F2',
			'F2F2F2',
			'F2F2F2',
			'F2F2F2',
			'F2F2F2',
		]); // recent colors (up to 8)
	}

	return colorPalette;
}

function createColor(
	parentContainer: Element,
	builder: any,
	palette: ColorPalette,
	colorItem: ColorItem,
	index: string,
	themeData: any,
	widgetData: ColorPaletteWidgetData,
	isCurrent: boolean,
): Element {
	const color = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-color-picker-entry',
		parentContainer,
	);
	color.style.backgroundColor = '#' + colorItem;
	color.setAttribute('name', colorItem);
	color.setAttribute('index', index);
	color.tabIndex = 0;
	if (themeData) color.setAttribute('theme', themeData);

	color.innerHTML = isCurrent ? '&#149;' : '&#160;';

	color.addEventListener('click', (event: MouseEvent) =>
		handleColorSelection(
			event.target as HTMLElement,
			builder,
			widgetData,
			palette,
		),
	);

	// Handle keyboard navigation and selection
	color.addEventListener('keydown', (event: KeyboardEvent) => {
		switch (event.key) {
			case 'Enter':
			case ' ':
				// Space or Enter key selects the color
				handleColorSelection(
					event.target as HTMLElement,
					builder,
					widgetData,
					palette,
				);
				event.preventDefault();
				break;
			case 'ArrowRight':
				moveFocus(color, 'next', 'horizontal');
				event.preventDefault();
				break;
			case 'ArrowLeft':
				moveFocus(color, 'previous', 'horizontal');
				event.preventDefault();
				break;
			case 'ArrowDown':
				moveFocus(
					color,
					'next',
					'vertical',
					parentContainer.nextElementSibling,
				);
				event.preventDefault();
				break;
			case 'ArrowUp':
				moveFocus(
					color,
					'previous',
					'vertical',
					parentContainer.previousElementSibling,
				);
				event.preventDefault();
				break;
			default:
				break;
		}
	});

	return color;
}

function handleColorSelection(
	target: HTMLElement,
	builder: any,
	widgetData: ColorPaletteWidgetData,
	palette: ColorPalette,
) {
	const colorCode = target.getAttribute('name');
	const themeData = target.getAttribute('theme');

	if (colorCode != null) {
		builder._sendColorCommand(builder, widgetData, colorCode, themeData);
		builder.callback(
			'colorpicker',
			'hidedropdown',
			widgetData,
			themeData ? themeData : colorCode,
			builder,
		);
	} else {
		builder._sendColorCommand(builder, widgetData, 'transparent');
		builder.callback(
			'colorpicker',
			'hidedropdown',
			widgetData,
			'transparent',
			builder,
		);
	}
	// Update the recent colors list
	const recentRow = palette[palette.length - 1];
	if (recentRow.indexOf(colorCode) !== -1)
		recentRow.splice(recentRow.indexOf(colorCode), 1);
	recentRow.unshift(colorCode);
	window.prefs.set('recentColor', JSON.stringify(recentRow));
}

function moveFocus(
	currentElement: HTMLElement,
	direction: 'next' | 'previous',
	axis: 'horizontal' | 'vertical',
	nextElement?: Element,
) {
	const focusableElements = Array.from(
		currentElement.parentElement?.querySelectorAll('.ui-color-picker-entry'),
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

	if (!targetElement && axis === 'vertical') {
		if (direction === 'next') {
			// Start from the next sibling of the parent container
			const nextFocusableElement = findFocusableElement(
				nextElement as HTMLElement,
				'next',
				isFocusable,
			);
			if (nextFocusableElement) {
				nextFocusableElement.focus();
			}
		} else if (direction === 'previous') {
			// Start from the previous sibling of the parent container
			const previousFocusableElement = findFocusableElement(
				nextElement as HTMLElement,
				'previous',
				isFocusable,
			);
			if (previousFocusableElement) {
				previousFocusableElement.focus();
			}
		}
	}

	if (targetElement) {
		targetElement.focus();
	}
}

function findFocusableElement(
	element: HTMLElement,
	direction: 'next' | 'previous',
	isFocusable: (el: HTMLElement) => boolean,
): HTMLElement | null {
	if (!element) {
		const mainColorContainer = document.querySelector('.ui-color-picker');
		const focusableElements = Array.from(
			mainColorContainer.querySelectorAll('*'),
		);
		const firstFocusableElement =
			direction === 'next'
				? (focusableElements.find(isFocusable) as HTMLElement)
				: (focusableElements.reverse().find(isFocusable) as HTMLElement);
		if (firstFocusableElement) {
			return firstFocusableElement;
		}
	}

	// Check the current element if it is focusable
	if (isFocusable(element)) return element;

	// Check if sibling is focusable or contains focusable elements
	const focusableInSibling = findFocusableWithin(
		element as HTMLElement,
		direction,
	);
	if (focusableInSibling) return focusableInSibling;

	// Depending on the direction, find the next or previous sibling
	const sibling: Element =
		direction === 'next'
			? element.nextElementSibling
			: element.previousElementSibling;

	if (sibling) {
		// Recursively check the next or previous sibling of the current sibling
		return findFocusableElement(sibling as HTMLElement, direction, isFocusable);
	}

	return null;
}

// Helper function to find the first focusable element within an element
function findFocusableWithin(
	element: HTMLElement,
	direction: string,
): HTMLElement | null {
	const focusableElements = Array.from(element.querySelectorAll('*'));
	return direction === 'next'
		? (focusableElements.find(isFocusable) as HTMLElement | null)
		: (focusableElements.reverse().find(isFocusable) as HTMLElement | null);
}

// Utility function to check if an element is focusable
function isFocusable(element: HTMLElement) {
	if (!element) return false;

	// Check if element is focusable (e.g., input, button, link, etc.)
	const focusableElements = [
		'a[href]',
		'button',
		'textarea',
		'input[type="text"]',
		'input[type="radio"]',
		'input[type="checkbox"]',
		'select',
		'[tabindex]:not([tabindex="-1"])',
	];

	return focusableElements.some((selector) => element.matches(selector));
}

function getRowColumn(element: HTMLElement): [number, number] {
	const index = element.getAttribute('index');
	if (!index) return [-1, -1]; // we will never have this kind of index this is why we are pssing nagative values here
	const [row, column] = index.split(':').map(Number);
	return [row, column];
}

function createAutoColorButton(
	parentContainer: Element,
	data: ColorPaletteWidgetData,
	builder: any,
) {
	const hasTransparent =
		data.command !== '.uno:FontColor' && data.command !== '.uno:Color';
	const buttonText = hasTransparent ? _('No fill') : _('Automatic');
	const autoButton = L.DomUtil.create(
		'button',
		builder.options.cssClass + ' ui-pushbutton auto-color-button',
		parentContainer,
	);
	autoButton.id = 'transparent-color-button';
	autoButton.innerText = buttonText;

	autoButton.addEventListener('click', () => {
		builder.map['stateChangeHandler'].setItemValue(data.command, -1);

		var parameters;
		if (data.command === '.uno:FontColor')
			parameters = { FontColor: { type: 'long', value: -1 } };
		else parameters = { Color: { type: 'long', value: -1 } };

		builder.map.sendUnoCommand(data.command, parameters);
		builder.callback('colorpicker', 'hidedropdown', data, '-1', builder);
	});
	autoButton.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'ArrowDown') {
			moveFocus(autoButton, 'next', 'vertical', autoButton.nextElementSibling);
			event.preventDefault();
		}
		if (event.key === 'ArrowUp') {
			moveFocus(
				autoButton,
				'previous',
				'vertical',
				autoButton.previousElementSibling,
			);
			event.preventDefault();
		}
	});
}

function createPaletteSwitch(
	parentContainer: Element,
	builder: any,
): HTMLSelectElement {
	const paletteListbox = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-listbox-container color-palette-selector',
		parentContainer,
	);
	const listbox = L.DomUtil.create(
		'select',
		builder.options.cssClass + ' ui-listbox',
		paletteListbox,
	);

	listbox.setAttribute('aria-labelledby', 'color-palette');

	for (const i in window.app.colorPalettes) {
		const paletteOption = L.DomUtil.create('option', '', listbox);
		if (i === getCurrentPaletteName())
			paletteOption.setAttribute('selected', 'selected');
		paletteOption.value = i;
		paletteOption.innerText = window.app.colorPalettes[i].name;
	}

	L.DomUtil.create(
		'span',
		builder.options.cssClass + ' ui-listbox-arrow',
		paletteListbox,
	);
	// Add keydown event listener to handle ArrowDown key
	listbox.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault(); // Prevent default behavior
		} else if (event.key === 'ArrowUp') {
			moveFocus(
				paletteListbox,
				'previous',
				'vertical',
				paletteListbox.previousElementSibling,
			);
			event.preventDefault();
		} else if (event.key === 'ArrowDown') {
			moveFocus(
				paletteListbox,
				'next',
				'vertical',
				paletteListbox.nextElementSibling,
			);
			event.preventDefault();
		}
	});

	return listbox;
}

function updatePalette(
	paletteName: string,
	data: ColorPaletteWidgetData,
	builder: any,
	paletteContainer: HTMLElement,
	customContainer: HTMLElement,
	recentContainer: HTMLElement,
) {
	const hexColor = String(builder._getCurrentColor(data, builder));
	const currentColor: ColorItem = hexColor.toUpperCase().replace('#', '');

	const palette = generatePalette(paletteName);
	const detailedPalette = window.app.colorPalettes[paletteName].colors;

	paletteContainer.style.gridTemplateRows =
		'repeat(' + (palette.length - 2) + ', auto)';
	paletteContainer.style.gridTemplateColumns =
		'repeat(' + palette[0].length + ', auto)';

	paletteContainer.innerHTML = '';
	for (let i = 0; i < palette.length - 2; i++) {
		for (let j = 0; j < palette[i].length; j++) {
			const themeData = detailedPalette[i][j].Data
				? JSON.stringify(detailedPalette[i][j].Data)
				: undefined;

			createColor(
				paletteContainer,
				builder,
				palette,
				palette[i][j],
				i + ':' + j,
				themeData,
				data,
				currentColor == palette[i][j],
			);
		}
	}

	customContainer.innerHTML = '';

	const customInput = L.DomUtil.create('input', '', customContainer);
	customInput.placeholder = '#FFF000';
	customInput.maxlength = 7;
	customInput.type = 'text';

	customInput.addEventListener('change', () => {
		let color = customInput.value;
		if (color.indexOf('#') === 0) color = color.substr(1);

		if (color.length != 6) {
			customInput.value = '';
			return;
		}

		const customColorRow = palette[palette.length - 2];
		if (customColorRow.indexOf(color) !== -1) {
			customColorRow.splice(customColorRow.indexOf(color), 1);
		}
		customColorRow.unshift(color.toUpperCase());
		window.prefs.set('customColor', JSON.stringify(customColorRow));
		updatePalette(
			paletteName,
			data,
			builder,
			paletteContainer,
			customContainer,
			recentContainer,
		);
	});
	//update here
	customInput.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'ArrowRight') {
			const nextElement = customInput.nextElementSibling as HTMLElement;
			if (nextElement) {
				nextElement.focus();
				event.preventDefault();
			}
		} else if (event.key === 'ArrowUp') {
			// Focus on the last element of the ui-color-picker-palette div
			moveFocus(customContainer, 'previous', 'vertical', paletteContainer);
			event.preventDefault();
		} else if (event.key === 'ArrowDown') {
			moveFocus(customContainer, 'next', 'vertical', recentContainer);
			event.preventDefault();
		}
	});

	const customColors = palette[palette.length - 2];
	for (let i = 0; i < customColors.length && i < 4; i++) {
		createColor(
			customContainer,
			builder,
			palette,
			customColors[i],
			'8:' + i,
			undefined,
			data,
			currentColor == customColors[i],
		);
	}

	recentContainer.innerHTML = '';
	const recentColors = palette[palette.length - 1];
	for (let i = 0; i < recentColors.length && i < 8; i++) {
		createColor(
			recentContainer,
			builder,
			palette,
			recentColors[i],
			'8:' + i,
			undefined,
			data,
			currentColor == recentColors[i],
		);
	}
}

JSDialog.colorPicker = function (
	parentContainer: Element,
	data: ColorPaletteWidgetData,
	builder: any,
) {
	const container = L.DomUtil.create('div', 'ui-color-picker', parentContainer);
	container.id = data.id;

	createAutoColorButton(container, data, builder);

	const listbox = createPaletteSwitch(container, builder);

	const paletteContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-color-picker-palette',
		container,
	);

	const customContainer = L.DomUtil.createWithId(
		'div',
		'ui-color-picker-custom',
		container,
	);

	const recentLabel = L.DomUtil.create('label', '', container);
	recentLabel.innerText = _('Recent');
	recentLabel.for = 'ui-color-picker-recent';

	const recentContainer = L.DomUtil.createWithId(
		'div',
		'ui-color-picker-recent',
		container,
	);

	updatePalette(
		getCurrentPaletteName(),
		data,
		builder,
		paletteContainer,
		customContainer,
		recentContainer,
	);

	listbox.addEventListener('change', () => {
		const newPaletteName = listbox.value;
		window.prefs.set('colorPalette', newPaletteName);
		updatePalette(
			newPaletteName,
			data,
			builder,
			paletteContainer,
			customContainer,
			recentContainer,
		);
	});

	return false;
};
