/* -*- js-indent-level: 8; fill-column: 100 -*- */

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
 * This file contains service which will coordinate operations which
 * should happen on server connection changes.
 */

interface ViewSetting {
	zoteroAPIKey?: string;
	accessibilityState: boolean;
}

class ServerConnectionService {
	public onViewSetting(viewSetting: ViewSetting) {
		app.console.debug('ServerConnectionService: onViewSetting');

		if (!app.map) {
			app.console.error('ServerConnectionService: missing map reference');
			return;
		}

		let zoteroPlugin = app.map.zotero;
		const zoteroAPIKey = viewSetting.zoteroAPIKey;
		if (window.zoteroEnabled && zoteroAPIKey && !zoteroPlugin) {
			app.console.debug('ServerConnectionService: initialize Zotero plugin');

			zoteroPlugin = L.control.zotero(app.map);
			zoteroPlugin.apiKey = zoteroAPIKey;

			app.map.zotero = zoteroPlugin;
			app.map.addControl(zoteroPlugin);

			zoteroPlugin.updateUserID();
		}

		if (viewSetting.accessibilityState) {
			app.console.debug('ServerConnectionService: initialize accessibility');
			app.map.lockAccessibilityOn();
		}
	}

	public onNotebookbarInCoreInit() {
		app.console.debug('ServerConnectionService: onNotebookbarInCoreInit');
	}
}
