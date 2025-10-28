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
 * Notebookbar.ShapesTab.ts
 */

class ShapesTab implements NotebookbarTab {
	public getName(): string {
		return 'Shapes';
	}

	public getEntry(): NotebookbarTabEntry {
		return {
			id: 'Shapes-tab-label',
			text: _('Shapes'),
			name: this.getName(),
			accessibility: {
				focusBack: false,
				combination: 'S',
				de: null,
			} as NotebookbarAccessibilityDescriptor,
		} as NotebookbarTabEntry;
	}

	/* ids have to match transition pane ids from the .ui in the core */
	public getContent(): NotebookbarTabContent {
		const content = [
			{
				id: 'shapes-group',
				type: 'overflowgroup',
				nofold: true,
				name: _('Shape Layouts'),
				children: [
					{
						id: 'shapelayouts_icons', // FIXME: here widget for shape layouts
						type: 'iconview',
						entries: [...Array(10).keys()].map((n: number) => {
							return { ondemand: false, selected: false, row: n };
						}),
					} as IconViewJSON,
				],
			} as OverflowGroupWidgetJSON,
			{
				id: 'transitions-icons-separator',
				type: 'separator',
				orientation: 'vertical',
			} as SeparatorWidgetJSON,
			{
				id: 'shapes content', // FIXME: here textbox for editing content
				type: 'textarea',
				text: 'type content here...'
			},
		];

		return content as NotebookbarTabContent;
	}
}

JSDialog.ShapesTab = new ShapesTab();
