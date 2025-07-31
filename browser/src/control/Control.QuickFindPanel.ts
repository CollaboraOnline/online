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
 * JSDialog.QuickFindPanel
 */

/* global app */
class QuickFindPanel {
	map: any;
	container: HTMLElement | null;
	builder: any;

	constructor(map: any) {
		this.map = map;
		this.container = document.querySelector('#quick-find-wrapper');
	}

	onAdd(map: any) {
		// this.map = map;
		this.map.on('quickfind', this.onQuickFind, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);

		this.builder = new L.control.jsDialogBuilder({
			mobileWizard: this,
			map: map,
			cssClass: `jsdialog sidebar`, // use sidebar css for now, have quickfind css later
			windowId: -5,
		});
	}

	onRemove() {
		this.map.off('quickfind', this.onQuickFind, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	}

	onQuickFind(data: any) {
		var quickFindData = data.data;
		this.builder.setWindowId(quickFindData.id);
		if (this.container) {
			this.container.innerHTML = '';
		}

		this.builder.build(this.container, [quickFindData]);

		app.showQuickFind = true;
		// this will update the indentation marks for elements like ruler
		app.map.fire('fixruleroffset');
	}

	onJSUpdate(data: any) {
		var data = data.data;

		if (data.jsontype !== 'quickfind') return;

		if (!this.container) return;

		if (!this.builder) return;

		this.builder.updateWidget(this.container, data.control);
	}

	onJSAction(data: any) {
		var data = data.data;

		if (data.jsontype !== 'quickfind') return;

		if (!this.builder) return;

		if (!this.container) return;

		var innerData = data.data;
		if (!innerData) return;

		this.builder.executeAction(this.container, innerData);
	}
}

JSDialog.QuickFindPanel = function (map: any) {
	return new QuickFindPanel(map);
};
