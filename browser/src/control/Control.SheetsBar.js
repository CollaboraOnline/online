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
 * Control.SheetsBar - toolbar with buttons for scrolling tabs
 */

/* global _ JSDialog */
class SheetsBar {

	constructor(map, showNavigation = true) {
		this.showNavigation = showNavigation;
		this.onAdd(map);
	}

	onAdd(map) {
		this.map = map;
		this.parentContainer = L.DomUtil.get('spreadsheet-toolbar');
		this.builder = new L.control.jsDialogBuilder(
			{
				mobileWizard: this,
				map: this.map,
				cssClass: 'jsdialog'
			});

		this.create();

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('updatepermission', this.onUpdatePermission, this);
	}

	create() {
		var data = [
			{
				id: 'sheets-buttons-toolbox',
				type: 'toolbox',
				children: [
					{
						id: 'firstrecord',
						type: 'customtoolitem',
						text: _('Scroll to the first sheet'),
						command: 'firstrecord',
						visible: this.showNavigation
					},
					{
						id: 'prevrecord',
						type: 'customtoolitem',
						text: _('Scroll left'),
						command: 'prevrecord',
						visible: this.showNavigation
					},
					{
						id: 'nextrecord',
						type: 'customtoolitem',
						text: _('Scroll right'),
						command: 'nextrecord',
						visible: this.showNavigation
					},
					{
						id: 'lastrecord',
						type: 'customtoolitem',
						text: _('Scroll to the last sheet'),
						command: 'lastrecord',
						visible: this.showNavigation
					},
					{
						id: 'insertsheet',
						type: 'customtoolitem',
						text: _('Insert sheet'),
						command: 'insertsheet'
					}
				]
			}
		];

		this.parentContainer.innerHTML = '';
		this.builder.build(this.parentContainer, data);
	}

	onDocLayerInit() {
		var docType = this.map.getDocType();
		if (docType == 'spreadsheet') {
			if (!window.mode.isMobile()) {
				this.show();
			}
		}
	}

	onUpdatePermission(e) {
		if (e.perm === 'edit') {
			this.enableInsertion(true);
		} else {
			this.enableInsertion(false);
		}
	}

	enableInsertion(enable) {
		this.builder.executeAction(this.parentContainer, {
			'control_id': 'insertsheet',
			'action_type': enable ? 'enable' : 'disable'
		});
	}

	show() {
		this.parentContainer.style.display = 'grid';
	}

	hide() {
		this.parentContainer.style.display = 'none';
	}
}

JSDialog.SheetsBar = function (map, showNavigation) {
	return new SheetsBar(map, showNavigation);
};
