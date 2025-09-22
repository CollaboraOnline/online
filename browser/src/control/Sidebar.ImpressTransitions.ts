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
 * Sidebar.ImpressTransitions - transitions sidebar, previously based on core
 *                              now we moved it to notebookbar but we need to
 *                              keep sidebar for compact mode. It will reuse
 *                              notebookbar widgets in the core.
 */

class ImpressTransitionsPanel extends Sidebar {
	constructor(map: any) {
		super(map);

		// transitions panel is now in the notebookbar in the core
		this.type = this.allowedJsonType = SidebarType.Notebookbar;
		this.builder?.setWindowId(WindowId.Notebookbar);

		this.map.off('sidebar', this.onSidebar, this); // from base class
		this.map.on('transitiondeck', this.onSidebar, this);
	}

	onRemove() {
		super.onRemove();
		this.map.off('transitiondeck');
	}

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

	public openTransitionSidebar() {
		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		app.map.fire('transitiondeck', {
			data: {
				id: WindowId.Notebookbar,
				jsontype: 'sidebar',
				type: 'container',
				visible: true,
				children: [
					{
						id: 'transitionsdeck',
						type: 'deck',
						enabled: true,
						visible: true,
						text: _('Transitions'),
						name: 'TransitionsDeck',
						children: [
							{
								id: 'transitionspanel',
								name: 'TransitionsPanel',
								text: _('Transitions'),
								visible: true,
								enabled: true,
								expanded: true,
								hidden: false,
								type: 'panel',
								children: JSDialog.ImpressTransitionTab.getContent(),
							},
						],
					},
				],
			},
		});
	}
}

JSDialog.ImpressTransitionsPanel = function (map: any) {
	return new ImpressTransitionsPanel(map);
};
