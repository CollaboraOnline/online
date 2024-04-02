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
 * MobileSearchBar - mobile search bar
 */

/* global _ _UNO */
class MobileSearchBar {
	map: any;
	builder: any;
	parentContainer: Element;

	constructor(map: any) {
		this.map = map;
		this.parentContainer = document.getElementById('toolbar-search');
		L.DomUtil.addClass(this.parentContainer, 'ui-toolbar');

		this.builder = new L.control.jsDialogBuilder({
			mobileWizard: this,
			map: this.map,
			cssClass: 'jsdialog',
			noLabelsForUnoButtons: true,
		});

		this.create();
	}

	showItem(command: string, show: boolean) {
		this.builder.executeAction(this.parentContainer, {
			control_id: command,
			action_type: show ? 'show' : 'hide',
		});
	}

	enableItem(command: string, enable: boolean) {
		this.builder.executeAction(this.parentContainer, {
			control_id: command,
			action_type: enable ? 'enable' : 'disable',
		});
	}

	getToolItems() {
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

L.control.searchBar = function (map: any) {
	return new MobileSearchBar(map);
};
