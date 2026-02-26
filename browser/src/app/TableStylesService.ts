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
		}
	}

	public applyStyle(newStyleNumber: number) {
		const tableStyle = app.map['stateChangeHandler'].getItemValue(
			'.uno:DatabaseSettings',
		) as TableStyleInfo;

		// PoolItem names ae different than ones from state handler
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
		args['DatabaseSettings.StrippedRows'] = {
			type: 'boolean',
			value: tableStyle.UseRowStripes,
		};
		args['DatabaseSettings.StrippedCols'] = {
			type: 'boolean',
			value: tableStyle.UseColStripes,
		};
		args['DatabaseSettings.ShowFilters'] = {
			type: 'boolean',
			value: tableStyle.AutoFilter,
		};

		const newStyleId = this.styles[newStyleNumber]?.Name;
		args['DatabaseSettings.StyleID'] = { type: 'string', value: newStyleId };

		app.map.sendUnoCommand('.uno:DatabaseSettings', args);
	}

	public generateJSON(): Array<IconViewEntry> {
		if (!this.styles) return [];

		const currentStyle = app.map['stateChangeHandler'].getItemValue(
			'.uno:DatabaseSettings',
		);

		const iconViewEntries = new Array<IconViewEntry>();
		let i = 0;

		iconViewEntries.push({
			row: i++,
			text: _('None'),
			image: 'images/lc_table_light_seven.svg',
			width: 35,
			height: 35,
			selected: !currentStyle || currentStyle.name === '',
		} as IconViewEntry);

		this.styles.forEach((element) => {
			iconViewEntries.push({
				row: i++,
				text: element.UIName,
				image: 'images/lc_table_light_seven.svg',
				width: 35,
				height: 35,
				selected: currentStyle ? element.Name === currentStyle.name : false,
			} as IconViewEntry);
		});

		return iconViewEntries;
	}
}
