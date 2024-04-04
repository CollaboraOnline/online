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
 * JSDialog.MobileSearchBar - mobile search bar
 */

/* global _ _UNO */
class MobileSearchBar extends Toolbar {
	constructor(map: any) {
		super(map, 'toolbar-search');
	}

	getToolItems(): Array<ToolbarItem> {
		return [
			{
				type: 'customtoolitem',
				id: 'hidesearchbar',
				w2icon: 'unfold',
				text: _('Hide the search bar'),
			},
			{ type: 'edit', id: 'search-input', placeholder: _('Search'), text: '' },
			{
				type: 'customtoolitem',
				id: 'searchprev',
				text: _UNO('.uno:UpSearch'),
				enabled: false,
			},
			{
				type: 'customtoolitem',
				id: 'searchnext',
				text: _UNO('.uno:DownSearch'),
				enabled: false,
			},
			{
				type: 'customtoolitem',
				id: 'cancelsearch',
				text: _('Clear the search field'),
				visible: false,
			},
			{ type: 'spacer', id: 'left' },
		];
	}

	create() {
		var items = this.getToolItems();
		this.builder.build(this.parentContainer, items);
		(window as any).setupSearchInput();
	}
}

JSDialog.MobileSearchBar = function (map: any) {
	return new MobileSearchBar(map);
};
