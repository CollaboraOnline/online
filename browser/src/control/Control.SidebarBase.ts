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
 * Control.SidebarBase
 */

/* global app */
declare var JSDialog: any;

enum SidebarType {
	Sidebar = 'sidebar',
	Navigator = 'navigator',
}
interface SidebarOptions {
	animSpeed: number;
}
abstract class SidebarBase {
	options: SidebarOptions;
	type: SidebarType;

	map: any;

	container: HTMLDivElement;
	builder: any;

	constructor(
		map: any,
		options: SidebarOptions = {
			animSpeed: 1000,
		} /* Default speed: to be used on load */,
		type: SidebarType,
	) {
		this.type = type;
		this.options = options;
		this.onAdd(map);
	}

	onAdd(map: ReturnType<typeof L.map>) {
		this.map = map;

		app.events.on('resize', this.onResize.bind(this));

		this.builder = new L.control.jsDialogBuilder({
			mobileWizard: this,
			map: map,
			cssClass: `jsdialog sidebar`, // use sidebar css for now, maybe have seperate css for navigator later
		});
		this.container = L.DomUtil.create(
			'div',
			`${this.type}-container`,
			$(`#${this.type}-panel`).get(0),
		);

		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
	}

	onRemove() {
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	}

	isVisible(): boolean {
		return $(`#${this.type}-dock-wrapper`).is(':visible');
	}

	closeSidebar() {
		$(`#${this.type}-dock-wrapper`).hide();
		this.map._onResize();

		if (!this.map.editorHasFocus()) {
			this.map.fire('editorgotfocus');
			this.map.focus();
		}

		this.map.uiManager.setDocTypePref(`Show${this.type}`, false);
	}

	onJSUpdate(e: FireEvent) {
		var data = e.data;

		if (data.jsontype !== this.type) return;

		if (!this.container) return;

		if (!this.builder) return;

		// reduce unwanted warnings in console
		if (data.control.id === 'addonimage') {
			window.app.console.log('Ignored update for control: ' + data.control.id);
			return;
		}

		this.builder.updateWidget(this.container, data.control);
	}

	onJSAction(e: FireEvent) {
		var data = e.data;

		if (data.jsontype !== this.type) return;

		if (!this.builder) return;

		if (!this.container) return;

		var innerData = data.data;
		if (!innerData) return;

		var controlId = innerData.control_id;

		// Panels share the same name for main containers, do not execute actions for them
		// if panel has to be shown or hidden, full update will appear
		if (
			controlId === 'contents' ||
			controlId === 'Panel' ||
			controlId === 'titlebar' ||
			controlId === 'addonimage'
		) {
			window.app.console.log(
				'Ignored action: ' +
					innerData.action_type +
					' for control: ' +
					controlId,
			);
			return;
		}

		this.builder.executeAction(this.container, innerData);
	}

	onResize() {
		var wrapper = document.getElementById(`${this.type}-dock-wrapper`);
		wrapper.style.maxHeight =
			document.getElementById('document-container').getBoundingClientRect()
				.height + 'px';
	}
}
JSDialog.SidebarBase = SidebarBase;
