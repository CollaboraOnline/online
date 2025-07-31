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
 * Util.MessageRouter - helper for routing JSDialog messages to correct components
 */

declare var JSDialog: any;

class JSDialogMessageRouter {
	// show labels instead of editable fields in message boxes
	private _preProcessMessageDialog(msgData: WidgetJSON) {
		for (var i in msgData.children) {
			var child = msgData.children[i];
			if (child.type === 'multilineedit') child.type = 'fixedtext';
			else if (child.children) this._preProcessMessageDialog(child);
		}
	}

	public processMessage(msgData: JSDialogJSON, callbackFn: JSDialogCallback) {
		// update existing component
		if (msgData.action) {
			var fireJSDialogEvent = function () {
				switch (msgData.action) {
					case 'update':
						app.socket._map.fire('jsdialogupdate', { data: msgData });
						return true;

					case 'action':
						app.socket._map.fire('jsdialogaction', { data: msgData });
						return true;
				}

				return false;
			};

			var isNotebookbarInitialized =
				app.socket._map.uiManager && app.socket._map.uiManager.notebookbar;
			if (
				(msgData.jsontype === 'notebookbar' && !isNotebookbarInitialized) ||
				(msgData.jsontype === 'addressinputfield' &&
					!app.socket._map.addressInputField)
			) {
				setTimeout(fireJSDialogEvent, 1000);
				return;
			} else if (fireJSDialogEvent() === true) {
				return;
			}
		}

		if (msgData.type === 'messagebox') this._preProcessMessageDialog(msgData);

		// appears in autofilter dropdown for hidden popups, we can ignore that
		if (msgData.jsontype === 'popup') return;

		// re/create component
		if (window.mode.isMobile()) {
			// allow to use desktop's JSDialog component to show dropdowns
			if (
				msgData.type === 'dropdown' ||
				msgData.type === 'snackbar' ||
				(msgData.type === 'modalpopup' &&
					msgData.id === JSDialog.generateModalId(app.idleHandlerId))
			) {
				app.socket._map.fire('jsdialog', {
					data: msgData,
					callback: callbackFn,
				});
				return;
			}

			// use mobile wizard
			if (msgData.type == 'borderwindow') return;
			if (msgData.jsontype === 'formulabar') {
				app.socket._map.fire('formulabar', { data: msgData });
				return;
			}
			if (
				msgData.enabled ||
				msgData.jsontype === 'dialog' ||
				msgData.type === 'modalpopup'
			) {
				app.socket._map.fire('mobilewizard', {
					data: msgData,
					callback: callbackFn,
				});
			} else {
				console.warn(
					'jsdialog: unhandled jsdialog mobile message: {jsontype: "' +
						msgData.jsontype +
						'", type: "' +
						msgData.type +
						'" ... }',
				);
			}
		} else if (msgData.jsontype === 'dialog') {
			app.socket._map.fire('jsdialog', { data: msgData, callback: callbackFn });
		} else if (msgData.jsontype === 'sidebar') {
			app.socket._map.fire('sidebar', { data: msgData });
		} else if (msgData.jsontype === 'navigator') {
			app.socket._map.fire('navigator', { data: msgData });
		} else if (msgData.jsontype === 'formulabar') {
			app.socket._map.fire('formulabar', { data: msgData });
		} else if (msgData.jsontype === 'notebookbar') {
			if (msgData.children) {
				for (var i = 0; i < msgData.children.length; i++) {
					if (msgData.children[i].type === 'control') {
						msgData.children[i].id = msgData.id;
						app.socket._map.fire('notebookbar', msgData.children[i]);
						return;
					}
				}
			}
		} else if (msgData.jsontype === 'quickfind') {
			app.socket._map.fire('quickfind', { data: msgData });
		} else {
			console.warn(
				'Unhandled jsdialog message: {jsontype: "' +
					msgData.jsontype +
					'", type: "' +
					msgData.type +
					'" ... }',
			);
		}
	}
}

JSDialog.MessageRouter = new JSDialogMessageRouter();
