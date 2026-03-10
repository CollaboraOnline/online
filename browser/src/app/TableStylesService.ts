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

function parseHex(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.substring(0, 2), 16),
		parseInt(h.substring(2, 4), 16),
		parseInt(h.substring(4, 6), 16),
	];
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
	const [r, g, b] = parseHex(hex);
	return toHex(
		r + (255 - r) * factor,
		g + (255 - g) * factor,
		b + (255 - b) * factor,
	);
}

function darkenColor(hex: string, factor: number): string {
	const [r, g, b] = parseHex(hex);
	return toHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

// derived from lc_table_light.svg
function lightSVG(gridColor: string, stripeColor: string): string {
	return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="32" height="32" fill="#FAFAFA"/>
<path d="M2.94995 4.29999H29.05V27.7H2.94995V4.29999Z" fill="white"/>
<path d="M29.8496 3.65039V7.5498H2.15039V3.65039H29.8496Z" stroke="${gridColor}" stroke-width="1.3"/>
<line x1="1.5" y1="7.20001" x2="30.4275" y2="7.20001" stroke="${gridColor}"/>
<path d="M2.5 8H29.5V13H2.5V8Z" fill="${stripeColor}"/>
<path d="M2.5 18H29.5V23H2.5V18Z" fill="${stripeColor}"/>
<path d="M10.2 4.29999V12.1H2.94995V13.4H10.2V17.3H2.94995V18.6H10.2V22.5H2.94995V23.8H10.2V27.7H11.65V23.8H20.35V27.7H21.8V23.8H29.05V22.5H21.8V18.6H29.05V17.3H21.8V13.4H29.05V12.1H21.8V4.29999H20.35V12.1H11.65V4.29999H10.2ZM11.65 13.4H20.35V17.3H11.65V13.4ZM11.65 18.6H20.35V22.5H11.65V18.6Z" fill="${gridColor}"/>
<path d="M2.95 3C2.1467 3 1.5 3.5798 1.5 4.3V27.7C1.5 28.4202 2.1467 29 2.95 29H29.05C29.8533 29 30.5 28.4202 30.5 27.7V4.3C30.5 3.5798 29.8533 3 29.05 3H2.95ZM2.95 4.3H10.2H11.65H20.35H21.8H29.05V12.1V13.4V17.3V18.6V22.5V23.8V27.7H21.8H20.35H11.65H10.2H2.95V23.8V22.5V18.6V17.3V13.4V12.1V4.3Z" fill="${gridColor}"/>
</svg>`;
}

// derived from lc_table_medium.svg
function mediumSVG(
	headerColor: string,
	stripeColor: string,
	bgColor: string,
): string {
	return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="32" height="32" fill="#FAFAFA"/>
<path d="M2.92542 3C2.13574 3 1.5 3.55833 1.5 4.25185V26.7852C1.5 27.4787 2.13574 28.037 2.92542 28.037H28.5831C29.3727 28.037 30.0085 27.4787 30.0085 26.7852V4.25185C30.0085 3.55833 29.3727 3 28.5831 3H2.92542ZM2.92542 4.25185H10.0525H11.478H20.0305H21.4559H28.5831V11.763V13.0148V16.7704V18.0222V21.7778V23.0296V26.7852H21.4559H20.0305H11.478H10.0525H2.92542V23.0296V21.7778V18.0222V16.7704V13.0148V11.763V4.25185Z" fill="white"/>
<path d="M1.5 3H30.5V29H1.5V3Z" fill="${bgColor}"/>
<path d="M1.5 7.33331H30.5V12.1481H1.5V7.33331Z" fill="${stripeColor}"/>
<path d="M1.5 18.4074H30.5V23.2222H1.5V18.4074Z" fill="${stripeColor}"/>
<path d="M1.5 5.88892H30.5V3.00003H1.5V5.88892Z" fill="${headerColor}"/>
<line x1="1.5" y1="6.58331" x2="30.5" y2="6.58331" stroke="white" stroke-width="1.5"/>
<path d="M9.55556 3V11.6667H1.5V13.1111H9.55556V17.4444H1.5V18.8889H9.55556V23.2222H1.5V24.6667H9.55556V29H11.1667V24.6667H20.8333V29H22.4444V24.6667H30.5V23.2222H22.4444V18.8889H30.5V17.4444H22.4444V13.1111H30.5V11.6667H22.4444V3H20.8333V11.6667H11.1667V3H9.55556ZM11.1667 13.1111H20.8333V17.4444H11.1667V13.1111ZM11.1667 18.8889H20.8333V23.2222H11.1667V18.8889Z" fill="white"/>
</svg>`;
}

// derived from lc_table_dark.svg
function darkSVG(
	headerColor: string,
	bodyColor: string,
	gridColor: string,
): string {
	return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="32" height="32" fill="#FAFAFA"/>
<path d="M1.50001 3C1.50001 3 1.5 3.5798 1.5 4.3V27.7C1.5 28.4202 2.1467 29 2.95 29H29.05C29.8533 29 30.5 28.4202 30.5 27.7V4.3C30.5 3.5798 30.5 3 30.5 3H1.50001ZM2.95 4.3H29.05V27.7C20.35 27.7 11.65 27.7 2.95 27.7C2.95 19.9 2.95 12.1 2.95 4.3Z" fill="${gridColor}"/>
<path d="M1.5 3C1.5 3 1.5 3.5798 1.5 4.3V27.7C1.5 27.7 2.6967 27.7 3.5 27.7H29.3125C30.1158 27.7 30.5625 27.7 30.5 27.7V4.3C30.5 3.5798 30.5 3 30.5 3H1.5ZM1.5 4.3H30.5V27.7C21.8 27.7 10.2 27.7 1.5 27.7C1.5 19.9 1.5 12.1 1.5 4.3Z" fill="${headerColor}"/>
<path d="M30.5 12.7H1.5V27.7H30.5V12.7Z" fill="${bodyColor}"/>
<path d="M9.55556 9H1.5V13.75H11.1667V18.5H1.5V23.25H9.95833H11.1667H20.8333H22.0417H30.5V18.5H22L22.0417 13.75H30.5V9H22.4444H11.1667H9.55556ZM11.1667 13.75H22.0417L22 18.5H11.1667V13.75Z" fill="${gridColor}"/>
<path d="M30.5 4.29999H1.5V7.69999H30.5V4.29999Z" fill="${headerColor}"/>
<path d="M1.5 8.34998H30.5" stroke="white" stroke-width="1.3"/>
</svg>`;
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

	private styleHasElement(
		style: TableStyleEntry,
		elementType: TableStyleElementType,
	) {
		for (const element of style.Elements)
			if (element.Type === elementType) return true;

		return false;
	}

	public applyStyle(newStyleNumber: number) {
		const tableStyleEntry = this.styles[newStyleNumber];
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

		let svg: string;

		if (style.Name.indexOf('Light') >= 0) {
			svg = lightSVG(wt, lightenColor(frs, 0.5));
		} else if (style.Name.indexOf('Medium') >= 0) {
			svg = mediumSVG(hr, frs, lightenColor(frs, 0.55));
		} else if (style.Name.indexOf('Dark') >= 0) {
			svg = darkSVG(hr, wt, darkenColor(wt, 0.35));
		} else {
			svg = lightSVG(wt, lightenColor(wt, 0.5));
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
			selected: !currentStyle || currentStyle.TableStyleName === '',
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
