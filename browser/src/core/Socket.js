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
 * L.Socket contains methods for the communication with the server
 */

/* global app _ errorMessages GraphicSelection SocketBase */

app.definitions.Socket = class Socket extends SocketBase {

	constructor(map) {
		super(map);
	}

	_onSocketClose(event) {
		window.app.console.debug('_onSocketClose:');
		if (!this._map._docLoadedOnce && this.ReconnectCount === 0) {
			var errorMsg, errorType = '';
			var reason = event.reason;
			if (reason && reason.startsWith('error:')) {
				var command = this.parseServerCmd(reason);
				if (command.errorCmd === 'internal' && command.errorKind === 'unauthorized') {
					errorType = 'websocketunauthorized';
					errorMsg = this._buildUnauthorizedMessage(command);
				} else if (command.errorCmd === 'storage' && command.errorKind === 'loadfailed') {
					errorType = 'websocketloadfailed';
					errorMsg = errorMessages.storage.loadfailed;
				} else {
					errorType = 'websocketgenericfailure';
					errorMsg = errorMessages.websocketgenericfailure;
				}
			} else {
				errorType = 'websocketproxyfailure';
				errorMsg = errorMessages.websocketproxyfailure;
			}
			this._map.fire('error', { msg: errorMsg, cmd: 'socket', kind: 'closed', id: 4 });
			var postMessageObj = {
				errorType: errorType,
				success: false,
				errorMsg: errorMsg,
				result: '',
			};
			this._map.fire('postMessage', { msgId: 'Action_Load_Resp', args: postMessageObj });
			return;
		}
		if (this.ReconnectCount > 0)
			return;

		var isActive = app.idleHandler._active;
		this._map.hideBusy();
		app.idleHandler._active = false;
		app.idleHandler._serverRecycling = false;

		if (this._map._docLayer) {
			this._map._docLayer.removeAllViews();
			this._map._docLayer._resetClientVisArea();
			if (GraphicSelection.hasActiveSelection())
				GraphicSelection.rectangle = null;
			if (this._map._docLayer._docType === 'presentation')
				app.setCursorVisibility(false);

			this._map._docLayer._resetCanonicalIdStatus();
			this._map._docLayer._resetViewId();
			this._map._docLayer._resetDocumentInfo();
		}

		if (isActive && this._reconnecting) {
			// Don't show this before first transparently trying to reconnect.
			this._map.fire('error', {msg: _('Well, this is embarrassing, we cannot connect to your document. Please try again.'), cmd: 'socket', kind: 'closed', id: 4});
		}

		// Reset wopi's app loaded so that reconnecting again informs outerframe about initialization
		this._map['wopi'].resetAppLoaded();
		this._map.fire('docloaded', {status: false});

		// We need to make sure that the message slurping processes the
		// events first, because there could have been a message like
		// "close: idle" from the server.
		// Without the timeout, we'd immediately reconnect (because the
		// "close: idle" was not processed yet).
		var that = this;
		setTimeout(function () {
			if (!that._reconnecting) {
				that._reconnecting = true;
				if (!app.idleHandler._documentIdle)
					that._map.showBusy(_('Reconnecting...'), false);
				app.idleHandler._activate();
			}
		}, 1 /* ms */);

		if (this._map.isEditMode()) {
			this._map.setPermission('view');
		}

		if (!this._map['wopi'].DisableInactiveMessages && app.sectionContainer && !app.sectionContainer.testing)
			this._map.uiManager.showSnackbar(_('The server has been disconnected.'));
	}
}
