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

/*
 * This file contains service which encapsulates table styles synchronization
 * with the core.
 */

// for uno
interface TableStyleInfo {
	ContainsHeader: boolean;
	TotalsRow: boolean;
	UseFirstColumnFormatting: boolean;
	UseLastColumnFormatting: boolean;
	UseRowStripes: boolean;
	UseColStripes: boolean;
	AutoFilter: boolean;
	TableStyleName: string;
}

// from state change
type TableStyleElementType =
	| 'WholeTable'
	| 'FirstColumnStripe'
	| 'FirstRowStripe'
	| 'LastColumn'
	| 'FirstColumn'
	| 'HeaderRow'
	| 'TotalRow';

interface TableStyleElement {
	Type: TableStyleElementType;
	FillColor: string; // hex value
}

interface TableStyleEntry {
	Name: string;
	UIName: string;
	Elements: Array<TableStyleElement>;
}

function getElementColor(
	style: TableStyleEntry,
	type: string,
): string | undefined {
	const el = style.Elements.find((e) => e.Type === type);
	return el ? el.FillColor : undefined;
}

function toHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return (
		'#' +
		clamp(r).toString(16).padStart(2, '0') +
		clamp(g).toString(16).padStart(2, '0') +
		clamp(b).toString(16).padStart(2, '0')
	);
}

function lightenColor(hex: string, factor: number): string {
	const [r, g, b] = parseHexToRgb(hex);
	return toHex(
		r + (255 - r) * factor,
		g + (255 - g) * factor,
		b + (255 - b) * factor,
	);
}

function darkenColor(hex: string, factor: number): string {
	const [r, g, b] = parseHexToRgb(hex);
	return toHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

class TableStylesService {
	private styles = new Array<TableStyleEntry>();

	public get(): Array<TableStyleEntry> {
		return this.styles;
	}

	constructor() {
		app.map.on('commandstatechanged', this.onCommandState.bind(this));
	}

	public onCommandState(e: any) {
		if (e.commandName === '.uno:TableStyles') {
			if (e.state === '') return;

			try {
				this.styles = JSON.parse(e.state).TableStyles;
			} catch (e) {
				app.console.error('Failed to parse TableStyles: ' + e);
			}

			app.map.fire('jsdialogupdate', {
				data: {
					id: WindowId.Notebookbar + '',
					type: '',
					jsontype: 'notebookbar',
					action: 'update',
					control: this.generateTableStylesJSON(),
				} as JSDialogJSON,
			});
		} else if (e.commandName === '.uno:DatabaseSettings') {
			const currentStyle = e.state as TableStyleInfo;

			let position = -1;
			if (currentStyle) {
				position = 0; // state set -> at least None can be selected

				for (const style of this.styles) {
					position++;

					if (style.Name === currentStyle.TableStyleName) break;
				}
			}

			app.map.fire('jsdialogaction', {
				data: {
					id: WindowId.Notebookbar + '',
					type: '',
					jsontype: 'notebookbar',
					action: 'action',
					data: {
						control_id: 'tablestyles_design',
						action_type: 'select',
						position: position,
						data: {
							position: position,
						},
					},
				} as JSDialogJSON,
			});
		}
	}

	public generateTableStylesJSON(): IconViewJSON {
		return {
			id: 'tablestyles_design',
			type: 'iconview',
			text: _('Table Styles'),
			command: '.uno:DatabaseSettings',
			aria: { label: _('Table Styles') },
			accessibility: { focusBack: true, combination: 'TS' },
			entries: this.generateJSON(),
			singleclickactivate: true,
			textWithIconEnabled: false, // standard names from core are not translated yet
			selectionmode: 'single',
		} as IconViewJSON;
	}

	public getNoneStyle(): TableStyleEntry {
		return {
			Name: 'None',
			UIName: _('None'),
			Elements: [],
		} as TableStyleEntry;
	}

	private styleHasElement(
		style: TableStyleEntry,
		elementType: TableStyleElementType,
	) {
		for (const element of style.Elements)
			if (element.Type === elementType) return true;

		return false;
	}

	public applyStyle(newStyleNumber: number) {
		const tableStyleEntry =
			newStyleNumber === -1 ? this.getNoneStyle() : this.styles[newStyleNumber];
		if (!tableStyleEntry) {
			app.console.error(
				'TableStylesService: not found style with id: ' + newStyleNumber,
			);
			return;
		}

		let tableStyle = app.map['stateChangeHandler'].getItemValue(
			'.uno:DatabaseSettings',
		) as TableStyleInfo;
		if (!tableStyle) {
			// fallback, generate from defined styles
			tableStyle = {
				ContainsHeader: this.styleHasElement(tableStyleEntry, 'HeaderRow'),
				TotalsRow: this.styleHasElement(tableStyleEntry, 'TotalRow'),
				UseFirstColumnFormatting: this.styleHasElement(
					tableStyleEntry,
					'FirstColumn',
				),
				UseLastColumnFormatting: this.styleHasElement(
					tableStyleEntry,
					'LastColumn',
				),
				UseRowStripes: this.styleHasElement(tableStyleEntry, 'FirstRowStripe'),
				UseColStripes: this.styleHasElement(
					tableStyleEntry,
					'FirstColumnStripe',
				),
				AutoFilter: true,
			} as TableStyleInfo;
		}

		// PoolItem names are different than ones from state handler
		const args = {} as any;
		args['DatabaseSettings.HeaderRow'] = {
			type: 'boolean',
			value: tableStyle.ContainsHeader,
		};
		args['DatabaseSettings.TotalRow'] = {
			type: 'boolean',
			value: tableStyle.TotalsRow,
		};
		args['DatabaseSettings.FirstCol'] = {
			type: 'boolean',
			value: tableStyle.UseFirstColumnFormatting,
		};
		args['DatabaseSettings.LastCol'] = {
			type: 'boolean',
			value: tableStyle.UseLastColumnFormatting,
		};
		args['DatabaseSettings.StripedRows'] = {
			type: 'boolean',
			value: tableStyle.UseRowStripes,
		};
		args['DatabaseSettings.StripedCols'] = {
			type: 'boolean',
			value: tableStyle.UseColStripes,
		};
		args['DatabaseSettings.ShowFilters'] = {
			type: 'boolean',
			value: tableStyle.AutoFilter,
		};

		const newStyleId = tableStyleEntry.Name;
		args['DatabaseSettings.StyleID'] = { type: 'string', value: newStyleId };

		app.map.sendUnoCommand('.uno:DatabaseSettings', args);
	}

	public generateIcon(style: TableStyleEntry): string {
		const wholeTable = getElementColor(style, 'WholeTable') || '000000';
		const headerRow = getElementColor(style, 'HeaderRow') || wholeTable;
		const firstRowStripe =
			getElementColor(style, 'FirstRowStripe') || wholeTable;

		const wt = '#' + wholeTable;
		const hr = '#' + headerRow;
		const frs = '#' + firstRowStripe;

		const getStyleIndex = (variant: string) => {
			const match = style.Name.match(new RegExp(`${variant}(\\d+)$`));
			return match ? parseInt(match[1], 10) : 1;
		};

		let svg: string;

		if (style.Name.indexOf('Light') >= 0) {
			svg = lightTableStyleSvg(
				hr,
				lightenColor(frs, 0.5),
				getStyleIndex('Light'),
			);
		} else if (style.Name.indexOf('Medium') >= 0) {
			svg = mediumTableStyleSvg(
				hr,
				frs,
				lightenColor(frs, 0.55),
				getStyleIndex('Medium'),
			);
		} else if (style.Name.indexOf('Dark') >= 0) {
			const darkStyleIndex = getStyleIndex('Dark');
			const gridColor =
				darkStyleIndex >= 8 && darkStyleIndex <= 11
					? strengthenColor(wt, 0.75)
					: darkenColor(wt, 0.35);
			svg = darkTableStyleSvg(hr, wt, gridColor, darkStyleIndex);
		} else {
			svg = lightTableStyleSvg(
				wt,
				lightenColor(wt, 0.5),
				getStyleIndex('Light'),
			);
		}

		return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
	}

	public generateJSON(): Array<IconViewEntry> {
		if (!this.styles) return [];

		const currentStyle = app.map['stateChangeHandler'].getItemValue(
			'.uno:DatabaseSettings',
		) as TableStyleInfo | undefined;

		const iconViewEntries = new Array<IconViewEntry>();
		let i = 0;

		iconViewEntries.push({
			row: -1,
			text: _('None'),
			image: 'images/lc_table_none.svg',
			width: 50,
			height: 50,
			selected:
				!currentStyle ||
				currentStyle.TableStyleName === '' ||
				currentStyle.TableStyleName === 'None',
		} as IconViewEntry);

		this.styles.forEach((element) => {
			const selected = currentStyle
				? element.Name === currentStyle.TableStyleName
				: false;
			iconViewEntries.push({
				row: i++,
				text: element.UIName,
				image: this.generateIcon(element),
				width: 50,
				height: 50,
				selected: selected,
			} as IconViewEntry);
		});

		return iconViewEntries;
	}
}
