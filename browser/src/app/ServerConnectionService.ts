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
	public constructor() {
		TileManager.appendAfterFirstTileTask(this.onFirstTileReceived.bind(this));
	}

	// below methods should be sorted in expected order of execution to help understand the init

	public onBasicUI() {
		app.console.debug('ServerConnectionService: onBasicUI');
	}

	public onViewSetting(viewSetting: ViewSetting) {
		app.console.debug('ServerConnectionService: onViewSetting');

		if (!app.map) {
			app.console.error('ServerConnectionService: missing map reference');
			return;
		}

		let zoteroPlugin = app.map.zotero;
		const zoteroAPIKey = viewSetting.zoteroAPIKey;
		if (
			window.zoteroEnabled &&
			zoteroAPIKey &&
			!zoteroPlugin &&
			!window.mode.isMobile()
		) {
			app.console.debug('ServerConnectionService: initialize Zotero plugin');

			zoteroPlugin = window.L.control.zotero(app.map);
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

	public onSpecializedUI(docType: string) {
		app.console.debug('ServerConnectionService: onSpecializedUI - ' + docType);
	}

	public onDocumentLoaded() {
		app.console.debug('ServerConnectionService: onDocumentLoaded');
	}

	public onFirstTileReceived() {
		app.console.debug('ServerConnectionService: onFirstTileReceived');

		if (!window.mode.isMobile()) {
			// show zotero items if needed
			const zoteroItems = [
				'zoteroaddeditbibliography',
				'zoterocontaineradd',
				'zoterocontainerrefresh',
				'zoteroSetDocPrefs',
				'references-zoterosetdocprefs-break',
			];
			const isWriter = app.map?._docLayer?.isWriter();
			if (isWriter && window.zoteroEnabled && app.map.zotero) {
				app.console.debug('ServerConnectionService: show UI for zotero');
				zoteroItems.forEach((id: string) =>
					app.map.uiManager.notebookbar.showItem(id),
				);
			} else {
				app.console.debug('ServerConnectionService: hide UI for zotero');
				zoteroItems.forEach((id: string) =>
					app.map.uiManager.notebookbar.hideItem(id),
				);
			}
		}

		// initialize notebookbar in core
		app.map.uiManager.initializeLateComponents();
	}

	public onNotebookbarInCoreInit() {
		app.console.debug('ServerConnectionService: onNotebookbarInCoreInit');
	}
}
