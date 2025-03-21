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
 * JSDialog.NavigatorPanel
 */

/* global app */
class NavigatorPanel extends SidebarBase {
	navigationPanel: HTMLElement;
	floatingNavIcon: HTMLElement;

	constructor(map: any, options: SidebarOptions) {
		super(map, options, SidebarType.Navigator);
	}

	onAdd(map: ReturnType<typeof L.map>) {
		super.onAdd(map);
		this.map.on('navigator', this.onNavigator, this);
		this.navigationPanel = document.getElementById(`navigation-sidebar`);
		this.floatingNavIcon = document.getElementById(`navigator-floating-icon`);
		this.map.on(
			'zoomend',
			function () {
				// Handle special case for impress as the view there is landscape so better to hide Floating Nav ICON on lower zoom compare to other app
				if (
					this.map.getZoom() >= 14 ||
					(this.map.getZoom() >= 13 && map.getDocType() === 'presentation')
				) {
					this.floatingNavIcon.classList.remove('visible');
				} else if (!this.map.uiManager.getBooleanDocTypePref('ShowNavigator')) {
					this.floatingNavIcon.classList.add('visible');
				}
			}.bind(this),
		);
	}

	onRemove() {
		super.onRemove();
		this.map.off('navigator');
		this.map.off('zoomend');
	}

	onNavigator(data: FireEvent) {
		var navigatorData = data.data;
		this.builder.setWindowId(navigatorData.id);
		$(this.container).empty();

		if (
			navigatorData.action === 'close' ||
			window.app.file.disableSidebar ||
			this.map.isReadOnlyMode()
		) {
			this.closeSidebar();
		} else if (navigatorData.children) {
			if (navigatorData.children.length) {
				this.onResize();
			}

			this.markNavigatorTreeView(navigatorData);

			this.builder.build(this.container, [navigatorData]);
			if (!this.isVisible()) {
				$('#navigator-dock-wrapper').show(200);
				this.navigationPanel.classList.add('visible');
				this.floatingNavIcon.classList.remove('visible');
				if (this.map.isPresentationOrDrawing()) {
					this.map.uiManager.switchNavigationTab('tab-slide-sorter'); // initially we will show slide sorter and not navigator
				}
			}

			this.map.uiManager.setDocTypePref('ShowNavigator', true);
		} else {
			this.closeSidebar();
		}
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

	closeSidebar() {
		this.navigationPanel.classList.remove('visible');
		this.floatingNavIcon.classList.add('visible');
		this.map.uiManager.setDocTypePref('ShowNavigator', false);
		super.closeSidebar();
	}
}

JSDialog.NavigatorPanel = function (map: any, options: SidebarOptions) {
	return new NavigatorPanel(map, options);
};
