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
	}

	onRemove() {
		super.onRemove();
		this.map.off('navigator');
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
			if (!this.isVisible()) $('#navigator-dock-wrapper').show(200);

			this.map.uiManager.setDocTypePref('ShowNavigator', true);
		} else {
			this.closeSidebar();
		}
	}
}

JSDialog.NavigatorPanel = function (map: any, options: SidebarOptions) {
	return new NavigatorPanel(map, options);
};
