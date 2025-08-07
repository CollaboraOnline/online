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
const QUICKFIND_WINDOW_ID = -5;
class QuickFindPanel extends SidebarBase {
	constructor(map: any) {
		// Initialize QuickFindPanel in core
		app.socket.sendMessage('uno .uno:QuickFind');
		super(map, SidebarType.QuickFind);
	}

	onAdd(map: any) {
		super.onAdd(map);
		this.builder.setWindowId(QUICKFIND_WINDOW_ID);

		this.map = map;
		this.map.on('quickfind', this.onQuickFind, this);
	}

	onRemove() {
		this.map.off('quickfind', this.onQuickFind, this);
	}

	onQuickFind(data: any) {
		const quickFindData = data.data;

		if (this.container) this.container.innerHTML = '';
		else console.error('QuickFind: no container');

		this.builder.build(this.container, [quickFindData], false);

		app.showQuickFind = true;
		// this will update the indentation marks for elements like ruler
		app.map.fire('fixruleroffset');
	}
}

JSDialog.QuickFindPanel = function (map: any) {
	return new QuickFindPanel(map);
};
