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

/* global app JSDialog _ errorMessages GraphicSelection TileManager SocketBase */

app.definitions.Socket = class Socket extends SocketBase {

	constructor(map) {
		super(map);
	}

	_delayMessage(textMsg) {
		var message = {msg: textMsg};
		this._delayedMessages.push(message);
	}

	_handleDelayedMessages(docLayer) {
		this._handlingDelayedMessages = true;

		while (this._delayedMessages.length) {
			var message = this._delayedMessages.shift();
			try {
				docLayer._onMessage(message.msg);
			} catch (e) {
				// unpleasant - but stops this one problem
				// event stopping an unknown number of others.
				window.app.console.error('Exception ' + e + ' emitting event ' + message, e.stack);
			}
		}

		this._handlingDelayedMessages = false;
	}

	_onStatusMsg(textMsg, command) {
		var that = this;

		if (!this._isReady()) {
			// Retry in a bit.
			setTimeout(function() {
				that._onStatusMsg(textMsg, command);
			}, 10);
			return;
		}

		if (!this._map._docLayer) {
			// initialize and append text input before doc layer
			this._map.initTextInput(command.type);

			// Reinitialize the menubar and top toolbar if browser settings are enabled.
			// During the initial `initializeBasicUI` call, we don't know if compact mode is enabled.
			// Before `doclayerinit`, we recheck the compact mode setting and if conditions are met,
			// add the top toolbar and menubar controls to the map.
			if (window.prefs.useBrowserSetting) {
				if (!window.mode.isMobile() && this._map.uiManager.getCurrentMode() === 'notebookbar')
					this._map.uiManager.removeClassicUI();
				else if (!this._map.menubar)
					this._map.uiManager.initializeMenubarAndTopToolbar();
			}

			// first status message, we need to create the document layer
			var tileWidthTwips = this._map.options.tileWidthTwips;
			var tileHeightTwips = this._map.options.tileHeightTwips;
			if (this._map.options.zoom !== this._map.options.defaultZoom) {
				var scale = this._map.options.crs.scale(this._map.options.defaultZoom - this._map.options.zoom);
				tileWidthTwips = Math.round(tileWidthTwips * scale);
				tileHeightTwips = Math.round(tileHeightTwips * scale);
			}

			var docLayer = null;
			var options = {
				tileWidthTwips: tileWidthTwips / app.dpiScale,
				tileHeightTwips: tileHeightTwips / app.dpiScale,
				docType: command.type,
				viewId: command.viewid
			};
			if (command.type === 'text')
				docLayer = new window.L.WriterTileLayer(options);
			else if (command.type === 'spreadsheet')
				docLayer = new window.L.CalcTileLayer(options);
			else if (command.type === 'presentation' || command.type === 'drawing')
				docLayer = new window.L.ImpressTileLayer(options);

			this._map._docLayer = docLayer;
			this._map.addLayer(docLayer);
			this._map.fire('doclayerinit');
		}
		else if (this._reconnecting) {
			// we are reconnecting ...
			this._map._docLayer._resetClientVisArea();
			TileManager.refreshTilesInBackground();
			this._map.fire('statusindicator', { statusType: 'reconnected' });

			var darkTheme = window.prefs.getBoolean('darkTheme');
			this._map.uiManager.activateDarkModeInCore(darkTheme);
			this._map.uiManager.applyInvert();
			this._map.uiManager.setCanvasColorAfterModeChange();

			if (!window.mode.isMobile())
				this._map.uiManager.initializeNotebookbarInCore();

			// close all the popups otherwise document textArea will not get focus
			this._map.uiManager.closeAll();
			this._map.setPermission(app.file.permission);
			window.migrating = false;
			this._map.uiManager.initializeSidebar();
			this._map.uiManager.refreshTheme();
		}

		this._map.fire('docloaded', {status: true});
		if (this._map._docLayer) {
			this._map._docLayer._onMessage(textMsg);

			// call update view list viewId if it is not defined yet
			if (!this._map._docLayer._getViewId())
				this._map.fire('updateviewslist');

			this._reconnecting = false;

			// Applying delayed messages
			// note: delayed messages cannot be done before:
			// a) docLayer.map is set by map.addLayer(docLayer)
			// b) docLayer._onStatusMsg (via _docLayer._onMessage)
			// has set the viewid
			this._handleDelayedMessages(docLayer);
		}
	}

	_onJSDialog(textMsg, callback) {
		var msgData = JSON.parse(textMsg.substring('jsdialog:'.length + 1));

		if (msgData.children && !app.util.isArray(msgData.children)) {
			window.app.console.warn('_onJSDialogMsg: The children\'s data should be created of array type');
			return;
		}

		JSDialog.MessageRouter.processMessage(msgData, callback);
	}

	_onHyperlinkClickedMsg(textMsg) {
		var link = null;
		var coords = null;
		var hyperlinkMsgStart = 'hyperlinkclicked: ';
		var coordinatesMsgStart = ' coordinates: ';

		if (textMsg.indexOf(coordinatesMsgStart) !== -1) {
			var coordpos = textMsg.indexOf(coordinatesMsgStart);
			link = textMsg.substring(hyperlinkMsgStart.length, coordpos);
			coords = textMsg.substring(coordpos+coordinatesMsgStart.length);
		} else
			link = textMsg.substring(hyperlinkMsgStart.length);

		this._map.fire('hyperlinkclicked', {url: link, coordinates: coords});
	}

	_onSocketError(event) {
		window.app.console.warn('_onSocketError:', event);
		this._map.hideBusy();
		// Let onclose (_onSocketClose) report errors.
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

	manualReconnect(timeout) {
		if (this._map._docLayer) {
			this._map._docLayer.removeAllViews();
		}
		app.idleHandler._active = false;
		this.close();
		clearTimeout(this.timer);
		setTimeout(function () {
			try {
				app.idleHandler._activate();
			} catch (error) {
				window.app.console.warn('Cannot activate map');
			}
		}, timeout);
	}
}
