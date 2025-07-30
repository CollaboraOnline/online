// @ts-strict-ignore
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
	enablePreview?: boolean;
	notifyPreview?: boolean;
}

interface ThemeColor {
	Value: string;
	Name: string;
	Data: {
		ThemeIndex: number;
		Transformations: { Type: string; Value: number }[];
	};
}

type ColorEntry = {
	hexCode: string;
	name: string;
};

type ColorItem = string;
type CoreColorPalette = Array<Array<{ Value: ColorItem }>>;
type ColorPalette = Array<Array<ColorItem>>;

function findColorName(hexCode: string): string {
	const color = window.app.colorNames.find(
		(c: ColorEntry) => c.hexCode.toLowerCase() === hexCode.toLowerCase(),
	);
	return color ? color.name : _('Unknown color');
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

function isChartEnabled(): boolean {
	// TODO Add support for line and text color
	return !!document.querySelector('#sidebar-panel .ChartTypePanel');
}

function isPreviewSupportedForCommand(command: string): boolean {
	return command === '.uno:FillColor';
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
	parentContainer: HTMLElement,
	builder: JSBuilder,
	colorItem: ColorItem,
	index: string,
	themeData: any,
	widgetData: ColorPaletteWidgetData,
	isCurrent: boolean,
	themeColors: ThemeColor[],
): Element {
	const color = L.DomUtil.create(
		'input',
		builder.options.cssClass + ' ui-color-picker-entry',
		parentContainer,
	);
	color.type = 'radio';
	color.name = 'color';
	color.value = colorItem;
	color.style.backgroundColor = '#' + colorItem;
	color.setAttribute('index', index);
	color.innerHTML = isCurrent ? '&#149;' : '&#160;';
	if (themeData) color.setAttribute('theme', themeData);

	// Set color tooltips
	var colorTooltip;
	const found = themeColors.find(
		(item: ThemeColor) => item.Value.toLowerCase() === colorItem.toLowerCase(),
	);
	if (found) colorTooltip = found.Name;
	else if (window.app.colorNames) colorTooltip = findColorName(colorItem);
	else colorTooltip = _('Unknown color');

	if (window.enableAccessibility) {
		color.setAttribute('aria-label', colorTooltip);
	} else {
		color.setAttribute('data-cooltip', colorTooltip);
	}

	// Assuming 'color' is your target HTMLElement
	color.addEventListener('click', (event: MouseEvent) => {
		handleColorSelection(
			event.target as HTMLElement, // The clicked element
			builder, // Pass the builder object
			widgetData, // Pass the widget data
		);
	});

	if (widgetData.enablePreview) {
		color.addEventListener('mouseenter', (event: MouseEvent) => {
			handleColorSelection(
				event.target as HTMLElement, // The clicked element
				builder, // Pass the builder object
				widgetData, // Pass the widget data
				true, // for preview
			);
		});
	}

	color.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.code === 'Enter') {
			handleColorSelection(
				event.target as HTMLElement, // The clicked element
				builder, // Pass the builder object
				widgetData, // Pass the widget data
			);
		}
	});
	L.control.attachTooltipEventListener(color, builder.map);

	return color;
}

function handleColorSelection(
	target: HTMLElement,
	builder: JSBuilder,
	widgetData: ColorPaletteWidgetData,
	isPreview: boolean = false,
) {
	// if we need to notify color preview state changes and
	// the color should be really applied and not just previewed (IisPreview)
	// we need to notify the core that this is not a preview
	if (widgetData.enablePreview && widgetData.notifyPreview && !isPreview) {
		app.socket.sendMessage('colorpreviewstate', 'false');
	}

	const palette = generatePalette(getCurrentPaletteName());
	const colorCode = target.getAttribute('value');
	const themeData = target.getAttribute('theme');

	if (colorCode != null) {
		JSDialog.sendColorCommand(builder, widgetData, colorCode, themeData);
		if (!isPreview) {
			builder.callback(
				'colorpicker',
				'hidedropdown',
				widgetData,
				themeData ? themeData : colorCode,
				builder,
			);
		}
	} else {
		JSDialog.sendColorCommand(builder, widgetData, 'transparent');
		if (!isPreview) {
			builder.callback(
				'colorpicker',
				'hidedropdown',
				widgetData,
				'transparent',
				builder,
			);
		}
	}

	if (!isPreview) {
		// Update the recent colors list
		const recentRow = palette[palette.length - 1];
		if (recentRow.indexOf(colorCode) !== -1)
			recentRow.splice(recentRow.indexOf(colorCode), 1);
		recentRow.unshift(colorCode);
		window.prefs.set('recentColor', JSON.stringify(recentRow));
	}
}

function createAutoColorButton(
	parentContainer: HTMLElement,
	data: ColorPaletteWidgetData,
	builder: JSBuilder,
) {
	// Create a div container for the button
	const buttonContainer = L.DomUtil.create(
		'div',
		'auto-color-button-container',
		parentContainer,
	);

	const hasTransparent =
		data.command !== '.uno:FontColor' && data.command !== '.uno:Color';
	const buttonText = hasTransparent ? _('No fill') : _('Automatic');
	const autoButton = L.DomUtil.create(
		'button',
		builder.options.cssClass + ' ui-pushbutton auto-color-button',
		buttonContainer, // Append button to the newly created div
	);
	autoButton.id = 'transparent-color-button';
	autoButton.innerText = buttonText;
	autoButton.tabIndex = '0';
	autoButton.focus();

	autoButton.addEventListener('click', () => {
		JSDialog.sendColorCommand(builder, data, 'transparent');
		builder.callback('colorpicker', 'hidedropdown', data, '-1', builder);
	});
}

function createPaletteSwitch(
	parentContainer: HTMLElement,
	builder: JSBuilder,
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
	listbox.setAttribute('tabindex', '0');

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
	builder: JSBuilder,
	paletteContainer: HTMLElement,
	customContainer: HTMLElement,
	recentContainer: HTMLElement,
) {
	const hexColor = String(JSDialog.getCurrentColor(data, builder));
	const currentColor: ColorItem = hexColor.toUpperCase().replace('#', '');

	const palette = generatePalette(paletteName);
	const detailedPalette = window.app.colorPalettes[paletteName].colors;
	const themeColors: ThemeColor[] =
		window.app.colorPalettes['ThemeColors'].colors.flat();

	paletteContainer.style.gridTemplateRows =
		'repeat(' + (palette.length - 2) + ', auto)';
	paletteContainer.style.gridTemplateColumns =
		'repeat(' + palette[0].length + ', auto)';

	paletteContainer.replaceChildren();
	for (let i = 0; i < palette.length - 2; i++) {
		for (let j = 0; j < palette[i].length; j++) {
			const themeData = detailedPalette[i][j].Data
				? JSON.stringify(detailedPalette[i][j].Data)
				: undefined;

			createColor(
				paletteContainer,
				builder,
				palette[i][j],
				i + ':' + j,
				themeData,
				data,
				currentColor == palette[i][j],
				themeColors,
			);
		}
	}

	customContainer.replaceChildren();

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

	const customColors = palette[palette.length - 2];
	for (let i = 0; i < customColors.length && i < 4; i++) {
		createColor(
			customContainer,
			builder,
			customColors[i],
			'8:' + i,
			undefined,
			data,
			currentColor == customColors[i],
			themeColors,
		);
	}

	recentContainer.replaceChildren();
	const recentColors = palette[palette.length - 1];
	for (let i = 0; i < recentColors.length && i < 8; i++) {
		createColor(
			recentContainer,
			builder,
			recentColors[i],
			'9:' + i,
			undefined,
			data,
			currentColor == recentColors[i],
			themeColors,
		);
	}
}

JSDialog.colorPicker = function (
	parentContainer: Element,
	data: ColorPaletteWidgetData,
	builder: JSBuilder,
) {
	const container = L.DomUtil.create('div', 'ui-color-picker', parentContainer);
	container.id = data.id;
	container.tabIndex = '-1'; // focus should be on first element in grid for color picker

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
	recentLabel.htmlFor = 'ui-color-picker-recent';

	const recentContainer = L.DomUtil.createWithId(
		'div',
		'ui-color-picker-recent',
		container,
	);

	data.enablePreview =
		(data.enablePreview ?? true) && isPreviewSupportedForCommand(data.command);

	if (data.enablePreview) {
		// we need to notify color preview mode for allowing core to know if
		// it has to reset current selected color palette for chart data series
		data.notifyPreview = data.command === '.uno:FillColor' && isChartEnabled();
		if (data.notifyPreview) {
			container.addEventListener('mouseenter', (event: MouseEvent) => {
				app.socket.sendMessage('colorpreviewstate true');
			});
			container.addEventListener('mouseleave', (event: MouseEvent) => {
				app.socket.sendMessage('colorpreviewstate false');
			});
		}

		const hexColor = JSDialog.getCurrentColor(data, builder);

		const currentColor: ColorItem =
			hexColor !== -1 ? String(hexColor).toUpperCase().replace('#', '') : null;

		let themeData: any = undefined;
		if (hexColor !== -1) {
			const paletteName = getCurrentPaletteName();
			const palette = generatePalette(paletteName);
			const detailedPalette = window.app.colorPalettes[paletteName].colors;
			for (let i = 0; i < palette.length - 2; i++) {
				for (let j = 0; j < palette[i].length; j++) {
					if (palette[i][j] === currentColor && detailedPalette[i][j].Data)
						themeData = JSON.stringify(detailedPalette[i][j].Data);
				}
			}
		}

		// on exit a palette group reset to current color
		const fakeTarget = L.DomUtil.create('div', '', null);
		if (currentColor) fakeTarget.setAttribute('name', currentColor);
		if (themeData) fakeTarget.setAttribute('theme', themeData);

		paletteContainer.addEventListener('mouseleave', (event: MouseEvent) => {
			handleColorSelection(
				fakeTarget,
				builder, // Pass the builder object
				data, // Pass the widget data
				true, // for preview
			);
		});

		customContainer.addEventListener('mouseleave', (event: MouseEvent) => {
			handleColorSelection(
				fakeTarget,
				builder, // Pass the builder object
				data, // Pass the widget data
				true, // for preview
			);
		});

		recentContainer.addEventListener('mouseleave', (event: MouseEvent) => {
			handleColorSelection(
				fakeTarget,
				builder, // Pass the builder object
				data, // Pass the widget data
				true, // for preview
			);
		});
	}

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

	JSDialog.MakeFocusCycle(container);

	return false;
};
