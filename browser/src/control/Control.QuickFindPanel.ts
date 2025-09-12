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

	onJSUpdate(e: FireEvent): void {
		var data = e.data;

		super.onJSUpdate(e);

		// handle placeholder text and quickfind controls visibility
		app.layoutingService.appendLayoutingTask(() => {
			if (data.control.id === 'numberofsearchfinds') {
				this.handleNumberOfSearchFinds(data.control);
			} else if (
				data.control.id === 'searchfinds' &&
				data.control.type === 'treelistbox'
			) {
				this.handleSearchFindsTreelistbox(data.control);
			}
		});
	}

	handleNumberOfSearchFinds(control: any): void {
		const placeholder = document.getElementById('quickfind-placeholder');

		const hasText = (control.text ?? '').trim().length > 0;
		if (placeholder) placeholder.classList.toggle('hidden', hasText);
	}

	handleSearchFindsTreelistbox(control: any): void {
		const placeholder = document.getElementById('quickfind-placeholder');
		const quickFindControls = document.getElementById('quickfind-controls');

		const isEmpty =
			!Array.isArray(control.entries) || control.entries.length === 0;

		if (placeholder) placeholder.classList.toggle('hidden', !isEmpty);
		if (quickFindControls)
			quickFindControls.classList.toggle('hidden', isEmpty);
	}

	addPlaceholderIfEmpty(quickFindData: any): any {
		const hasEntries =
			quickFindData.children &&
			quickFindData.children.some(
				(child: any) =>
					child.type === 'treelistbox' &&
					child.entries &&
					child.entries.length > 0,
			);

		if (!hasEntries) {
			const modifiedData = JSON.parse(JSON.stringify(quickFindData));

			if (!modifiedData.children) modifiedData.children = [];

			modifiedData.children.unshift({
				id: 'quickfind-placeholder',
				type: 'fixedtext',
				text: _('Type in the search box to find anything in your document'),
				visible: true,
			});

			return modifiedData;
		}

		return quickFindData;
	}

	onQuickFind(data: any) {
		const quickFindData = data.data;

		if (this.container) this.container.innerHTML = '';
		else console.error('QuickFind: no container');

		const modifiedData = this.addPlaceholderIfEmpty(quickFindData);

		this.builder.build(this.container, [modifiedData], false);

		app.showQuickFind = true;
		// this will update the indentation marks for elements like ruler
		app.map.fire('fixruleroffset');
	}
}

JSDialog.QuickFindPanel = function (map: any) {
	return new QuickFindPanel(map);
};
