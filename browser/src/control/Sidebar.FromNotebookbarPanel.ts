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

enum NotebookbarBasedSidebarId {
	Animations = 'animations',
	Transitions = 'transitions',
	Shapes = 'shapes',
}

class SidebarFromNotebookbarPanel extends Sidebar {
	models: Map<string, JSDialogModelState>;
	isCustomCallbackUsed: boolean = false;

	/// converts notebookbar tab into sidebar-compatible JSON
	convertToModel(id: string, raw: NotebookbarTabContent): JSDialogJSON {
		return {
			id: id,
			jsontype: 'sidebar',
			type: 'container',
			dialogid: '0',
			children: raw,
			vertical: true,
		} as any as JSDialogJSON;
	}

	appendModel(
		id: NotebookbarBasedSidebarId,
		name: string,
		notebookbarTab: NotebookbarTab,
	) {
		this.models.set(id, new JSDialogModelState(name));
		this.models
			.get(id)
			?.fullUpdate(this.convertToModel(name, notebookbarTab.getContent()));
	}

	constructor(map: any) {
		super(map);

		// transitions panel is now in the notebookbar in the core
		this.type = this.allowedJsonType = SidebarType.Notebookbar;
		this.builder?.setWindowId(WindowId.Notebookbar);

		// we need to store all the variants and just copy them to the parent class model if needed
		this.models = new Map<string, JSDialogModelState>();
		this.appendModel(
			NotebookbarBasedSidebarId.Animations,
			'AnimationsSidebar',
			JSDialog.ImpressAnimationTab,
		);
		this.appendModel(
			NotebookbarBasedSidebarId.Transitions,
			'TransitionsSidebar',
			JSDialog.ImpressTransitionTab,
		);
		this.appendModel(
			NotebookbarBasedSidebarId.Shapes,
			'ShapesSidebar',
			JSDialog.ShapesTab,
		);

		this.map.off('sidebar', this.onSidebar, this); // from Sidebar class
		this.map.on('customsidebar', this.onSidebar, this);
	}

	onRemove() {
		super.onRemove();
		this.map.off('customsidebar');
	}

	/// callback on widget actions done by user
	protected callback(
		objectType: string,
		eventType: string,
		object: any,
		data: any,
		builder: JSBuilder,
	) {
		if (this.isCustomCallbackUsed) {
			app.console.error('Shapes Sidebar: ' + eventType + ' ' + JSON.stringify(object) + ' ' + data);
			// do some core messaging here...
			app.socket.sendMessage('shapeslayout');
		} else {
			builder._defaultCallbackHandler(
				objectType,
				eventType,
				object,
				data,
				builder,
			);
		}
	}


	/// apply to the cached model too
	protected onJSUpdate(e: any) {
		var data = e.data;

		if (data.jsontype !== this.allowedJsonType) return false;

		for (const [id, model] of this.models) model.widgetUpdate(data);

		return super.onJSUpdate(e);
	}

	/// apply to the cached model too
	protected onJSAction(e: any) {
		var data = e.data;

		if (data.jsontype !== this.allowedJsonType) return false;

		for (const [id, model] of this.models) model.widgetAction(data);

		return super.onJSAction(e);
	}

	public openTransitionsSidebar() {
		this.isCustomCallbackUsed = false;

		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		this.openSidebar(
			NotebookbarBasedSidebarId.Transitions,
			_('Transitions'),
			this.models.get(NotebookbarBasedSidebarId.Transitions)?.getSnapshot(),
		);
	}

	public openAnimationsSidebar() {
		this.isCustomCallbackUsed = false;

		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		this.openSidebar(
			NotebookbarBasedSidebarId.Animations,
			_('Animations'),
			this.models.get(NotebookbarBasedSidebarId.Animations)?.getSnapshot(),
		);
	}

	public openShapesSidebar() {
		// we need to clean the core based sidebars
		this.closeSidebar();
		this.setupTargetDeck(null);
		// TODO: change state of old sidebar uno commands

		this.isCustomCallbackUsed = true;

		this.openSidebar(
			NotebookbarBasedSidebarId.Shapes,
			_('Shapes'),
			this.models.get(NotebookbarBasedSidebarId.Shapes)?.getSnapshot(),
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
