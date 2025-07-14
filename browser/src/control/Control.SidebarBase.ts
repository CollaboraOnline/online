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
 * Control.SidebarBase
 */

/* global app */
declare var JSDialog: any;

enum SidebarType {
	Sidebar = 'sidebar',
	Navigator = 'navigator',
}
abstract class SidebarBase {
	type: SidebarType;

	map: any;

	container: HTMLDivElement;
	documentContainer: HTMLDivElement;
	wrapper: HTMLElement;
	builder: any;

	constructor(map: any, type: SidebarType) {
		this.type = type;
		this.onAdd(map);
	}

	onAdd(map: ReturnType<typeof L.map>) {
		this.map = map;

		app.events.on('resize', this.onResize.bind(this));

		this.builder = new L.control.jsDialogBuilder({
			mobileWizard: this,
			map: map,
			cssClass: `jsdialog sidebar`, // use sidebar css for now, maybe have seperate css for navigator later
			useScrollAnimation: false, // icon views cause jump on sidebar open
			suffix: 'sidebar',
		});
		this.container = L.DomUtil.create(
			'div',
			`${this.type}-container`,
			$(`#${this.type}-panel`).get(0),
		);
		this.wrapper = document.getElementById(`${this.type}-dock-wrapper`);
		this.documentContainer = document.querySelector('#document-container');

		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
	}

	onRemove() {
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	}

	isVisible(): boolean {
		return $(`#${this.type}-dock-wrapper`).hasClass('visible');
	}

	closeSidebar() {
		$(`#${this.type}-dock-wrapper`).removeClass('visible');

		if (!this.map.editorHasFocus()) {
			this.map.fire('editorgotfocus');
			this.map.focus();
		}

		const upperCaseType = this.type[0].toUpperCase() + this.type.slice(1);
		this.map.uiManager.setDocTypePref('Show' + upperCaseType, false);
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
			controlId.indexOf('contents') === 0 ||
			controlId.indexOf('titlebar') === 0 ||
			controlId.indexOf('expander') === 0 ||
			controlId.indexOf('addonimage') === 0
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
	markNavigatorTreeView(data: WidgetJSON): boolean {
		if (!data) return false;

		if (data.type === 'treelistbox') {
			(data as TreeWidgetJSON).draggable = false;
			return true;
		}

		for (const i in data.children) {
			if (this.markNavigatorTreeView(data.children[i])) {
				return true;
			}
		}

		return false;
	}
	onResize() {
		this.wrapper.style.maxHeight =
			this.documentContainer.getBoundingClientRect().height + 'px';
	}
}
JSDialog.SidebarBase = SidebarBase;
