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

function getCurrentPaletteName(): string {
	return localStorage &&
		localStorage.colorPalette &&
		window.app.colorPalettes[localStorage.colorPalette]
		? localStorage.colorPalette
		: 'StandardColors';
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
	const customColorRow = localStorage.customColor;
	const recentRow = localStorage.recentColor;

	if (typeof customColorRow !== 'undefined') {
		colorPalette.push(JSON.parse(customColorRow));
	} else {
		colorPalette.push(['F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2']); // custom colors (up to 4)
	}

	if (typeof recentRow !== 'undefined') {
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
	color.style = 'background-color: #' + colorItem;
	color.setAttribute('name', colorItem);
	color.setAttribute('index', index);
	color.tabIndex = 0;
	if (themeData) color.setAttribute('theme', themeData);

	color.innerHTML = isCurrent ? '&#149;' : '&#160;';

	color.addEventListener('click', (event: MouseEvent) => {
		const target = event.target as Element;
		const colorCode = target.getAttribute('name');
		const themeData = target.getAttribute('theme');

		if (colorCode != null) {
			if (colorCode) {
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
		}

		const recentRow = palette[palette.length - 1];
		if (recentRow.indexOf(colorItem) !== -1)
			recentRow.splice(recentRow.indexOf(colorItem), 1);
		recentRow.unshift(colorItem);
		localStorage.setItem('recentColor', JSON.stringify(recentRow));
	});

	return color;
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
		localStorage.setItem('customColor', JSON.stringify(customColorRow));
		updatePalette(
			paletteName,
			data,
			builder,
			paletteContainer,
			customContainer,
			recentContainer,
		);
	});

	const customColors = palette[palette.length - 2];
	for (let i = 0; i < customColors.length && i < 4; i++) {
		createColor(
			customContainer,
			builder,
			palette,
			customColors[i],
			'8:0',
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
			'8:0',
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
		localStorage.setItem('colorPalette', newPaletteName);
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
