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

const ANIMATIONS_ID = 'animations';
const TRANSITIONS_ID = 'transitions';

class SidebarFromNotebookbarPanel extends Sidebar {
	models: Map<string, JSDialogModelState>;

	constructor(map: any) {
		super(map);

		// we need to store all the variants and just copy them to the parent class model if needed
		this.models = new Map<string, JSDialogModelState>();
		this.models.set(ANIMATIONS_ID, new JSDialogModelState('AnimationsSidebar'));
		this.models.get(ANIMATIONS_ID)?.fullUpdate(JSDialog.ImpressAnimationTab.getContent());
		this.models.set(TRANSITIONS_ID, new JSDialogModelState('TransitionsSidebar'));
		this.models.get(TRANSITIONS_ID)?.fullUpdate(JSDialog.ImpressTransitionTab.getContent());

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

	public openTransitionsSidebar() {
		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		this.openSidebar(
			TRANSITIONS_ID,
			_('Transitions'),
			this.models.get(TRANSITIONS_ID)?.getSnapshot(),
		);
	}

	public openAnimationsSidebar() {
		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		this.openSidebar(
			ANIMATIONS_ID,
			_('Animations'),
			this.models.get(ANIMATIONS_ID)?.getSnapshot(),
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
