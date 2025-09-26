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
 * Sidebar.FromNotebookbarPanel - sidebar, previously based on core
 *                               now  moved to notebookbar but we need to
 *                               keep sidebar for compact mode. It will reuse
 *                               notebookbar widgets in the core.
 */

class SidebarFromNotebookbarPanel extends Sidebar {
	constructor(map: any) {
		super(map);

		// transitions panel is now in the notebookbar in the core
		this.type = this.allowedJsonType = SidebarType.Notebookbar;
		this.builder?.setWindowId(WindowId.Notebookbar);

		this.map.off('sidebar', this.onSidebar, this); // from Sidebar class
		this.map.on('customsidebar', this.onSidebar, this);
	}

	onRemove() {
		super.onRemove();
		this.map.off('customsidebar');
	}

	public openTransitionSidebar() {
		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		this.openSidebar(
			'transitions',
			_('Transitions'),
			JSDialog.ImpressTransitionTab.getContent(),
		);
	}

	// reuse Sidebar container
	protected setupContainer(parentContainer?: HTMLElement) {
		this.container = document.getElementById(
			`${this.type}-container`,
		) as HTMLElement;
		this.wrapper = document.getElementById(
			`${this.type}-dock-wrapper`,
		) as HTMLElement;
		this.documentContainer = document.querySelector(
			'#document-container',
		) as HTMLDivElement;
	}

	protected openSidebar(id: string, title: string, content: Array<WidgetJSON>) {
		app.map.fire('customsidebar', {
			data: {
				id: WindowId.Notebookbar,
				jsontype: 'sidebar',
				type: 'container',
				visible: true,
				children: [
					{
						id: id + '-deck',
						type: 'deck',
						enabled: true,
						visible: true,
						text: title,
						name: id + '-deck',
						children: [
							{
								id: id + '-panel',
								name: id + '-panel',
								text: title,
								visible: true,
								enabled: true,
								expanded: true,
								hidden: false,
								type: 'panel',
								children: content,
							},
						],
					},
				],
			},
		});
	}
}

JSDialog.SidebarFromNotebookbarPanel = function (map: any) {
	return new SidebarFromNotebookbarPanel(map);
};
