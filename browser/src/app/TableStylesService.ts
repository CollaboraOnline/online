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
		const tableStyle = this.styles[newStyleNumber];
		if (!tableStyle) {
			app.console.error(
				'TableStylesService: not found style with id: ' + newStyleNumber,
			);
			return;
		}

		// PoolItem names ae different than ones from state handler
		const args = {} as any;
		args['DatabaseSettings.HeaderRow'] = {
			type: 'boolean',
			value: this.styleHasElement(tableStyle, 'HeaderRow'),
		};
		args['DatabaseSettings.TotalRow'] = {
			type: 'boolean',
			value: this.styleHasElement(tableStyle, 'TotalRow'),
		};
		args['DatabaseSettings.FirstCol'] = {
			type: 'boolean',
			value: this.styleHasElement(tableStyle, 'FirstColumn'),
		};
		args['DatabaseSettings.LastCol'] = {
			type: 'boolean',
			value: this.styleHasElement(tableStyle, 'LastColumn'),
		};
		args['DatabaseSettings.StripedRows'] = {
			type: 'boolean',
			value: this.styleHasElement(tableStyle, 'FirstRowStripe'),
		};
		args['DatabaseSettings.StripedCols'] = {
			type: 'boolean',
			value: this.styleHasElement(tableStyle, 'FirstColumnStripe'),
		};
		args['DatabaseSettings.ShowFilters'] = {
			type: 'boolean',
			value: true, // not present in style data
		};

		const newStyleId = tableStyle.Name;
		args['DatabaseSettings.StyleID'] = { type: 'string', value: newStyleId };

		app.map.sendUnoCommand('.uno:DatabaseSettings', args);
	}

	public generateIcon(style: TableStyleEntry): string {
		// probably standard names
		if (style.Name.indexOf('Light') >= 0) return 'images/lc_table_light.svg';
		else if (style.Name.indexOf('Medium') >= 0)
			return 'images/lc_table_medium.svg';
		else if (style.Name.indexOf('Dark') >= 0) return 'images/lc_table_dark.svg';

		// custom style - use dummy heuristic
		if (style.Elements.length > 1) return 'images/lc_table_medium.svg';
		else if (style.Elements.length > 2) return 'images/lc_table_dark.svg';

		return 'images/lc_table_light.svg';
	}

	public generateJSON(): Array<IconViewEntry> {
		if (!this.styles) return [];

		const currentStyle = app.map['stateChangeHandler'].getItemValue(
			'.uno:DatabaseSettings',
		);

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
