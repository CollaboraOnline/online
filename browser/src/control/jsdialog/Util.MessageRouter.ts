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

interface WidgetJSON {
	id: string; // unique id of a widget
	type: string; // type of widget
	enabled: boolean | undefined; // enabled state
	visible: boolean | undefined; // visibility state
	children: Array<WidgetJSON> | undefined; // child nodes
}

interface JSDialogJSON extends WidgetJSON {
	id: string; // unique windowId
	jsontype: string; // specifies target componenet, on root level only
	action: string | undefined; // optional name of an action
}

type JSDialogCallback = (
	objectType: string,
	eventType: string,
	object: any,
	data: any,
	builder: any,
) => void;

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
						app.map.fire('jsdialogupdate', { data: msgData });
						return true;

					case 'action':
						app.map.fire('jsdialogaction', { data: msgData });
						return true;
				}

				return false;
			};

			var isNotebookbarInitialized =
				app.map.uiManager && app.map.uiManager.notebookbar;
			if (msgData.jsontype === 'notebookbar' && !isNotebookbarInitialized) {
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
				app.map.fire('jsdialog', { data: msgData, callback: callbackFn });
				return;
			}

			// use mobile wizard
			if (msgData.type == 'borderwindow') return;
			if (msgData.jsontype === 'formulabar') {
				app.map.fire('formulabar', { data: msgData });
				return;
			}
			if (
				msgData.enabled ||
				msgData.jsontype === 'dialog' ||
				msgData.type === 'modalpopup'
			) {
				app.map.fire('mobilewizard', { data: msgData, callback: callbackFn });
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
			app.map.fire('jsdialog', { data: msgData, callback: callbackFn });
		} else if (msgData.jsontype === 'sidebar') {
			app.map.fire('sidebar', { data: msgData });
		} else if (msgData.jsontype === 'formulabar') {
			app.map.fire('formulabar', { data: msgData });
		} else if (msgData.jsontype === 'notebookbar') {
			if (msgData.children) {
				for (var i = 0; i < msgData.children.length; i++) {
					if (msgData.children[i].type === 'control') {
						msgData.children[i].id = msgData.id;
						app.map.fire('notebookbar', msgData.children[i]);
						return;
					}
				}
			}
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
