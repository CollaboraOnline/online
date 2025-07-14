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
 * JSDialog.QuickFindPanel
 */

/* global app */
class QuickFindPanel {
	map: any;
	container: HTMLElement;
	constructor() {
		this.container = document.querySelector('#quick-find-wrapper');
	}

	onAdd(map: any) {
		this.map = map;
		this.map.on('quickfind', this.onQuickFind, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
	}

	onRemove() {
		this.map.off('quickfind', this.onQuickFind, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	}

	onQuickFind(data: any) {
		// todo: implement
		console.log('QuickFindPanel.onQuickFind');
	}

	onJSUpdate(data: any) {
		// todo: implement
		console.log('QuickFindPanel.onJSUpdate');
	}

	onJSAction(data: any) {
		// todo: implement
		console.log('QuickFindPanel.onJSAction');
	}
}

JSDialog.QuickFindPanel = function () {
	return new QuickFindPanel();
};
