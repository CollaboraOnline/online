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

/* global app JSDialog _ errorMessages brandProductName GraphicSelection TileManager SlideBitmapManager SocketBase */

app.definitions.Socket = class Socket extends SocketBase {

	constructor(map) {
		super(map);
	}

	_onMessage(e) {
		var imgBytes, textMsg;

		textMsg = e.textMsg;
		imgBytes = e.imgBytes;

		if (window.L.Browser.cypressTest) {
			window.L.initial._stubMessage(textMsg);
		}

		this._logSocket('INCOMING', textMsg);

		var command = this.parseServerCmd(textMsg);

		if (textMsg.startsWith('coolserver ')) {
			if (this._onCoolServerMsg(textMsg)) {
				return;
			}
		}
		else if (textMsg.startsWith('lokitversion ')) {
			this._onLokitVersionMsg(textMsg);
		}
		else if (textMsg.startsWith('enabletraceeventlogging ')) {
			this.enableTraceEventLogging = true;
		}
		else if (textMsg.startsWith('osinfo ')) {
			this._onOsInfoMsg(textMsg);
		}
		else if (textMsg.startsWith('clipboardkey: ')) {
			this._onClipboardKeyMsg(textMsg);
		}
		else if (textMsg.startsWith('perm:')) {
			this._onPermMsg(textMsg);
			return;
		}
		else if (textMsg.startsWith('filemode:')) {
			this._onFileModeMsg(textMsg);
		}
		else if (textMsg.startsWith('lockfailed:')) {
			this._map.onLockFailed(textMsg.substring('lockfailed:'.length).trim());
			return;
		}
		else if (textMsg.startsWith('wopi: ')) {
			this._onWopiMsg(textMsg);
			return;
		}
		else if (textMsg.startsWith('loadstorage: ')) {
			this._onLoadStorageMsg(textMsg);
		}
		else if (textMsg.startsWith('lastmodtime: ')) {
			this._onLastModTimeMsg(textMsg);
			return;
		}
		else if (textMsg.startsWith('commandresult: ')) {
			this._onCommandResultMsg(textMsg);
			return;
		}
		else if (textMsg.startsWith('migrate:') && window.indirectSocket) {
			this._onMigrateMsg(textMsg);
			return;
		}
		else if (textMsg.startsWith('close: ')) {
			this._onCloseMsg(textMsg);
			return;
		}
		else if (textMsg.startsWith('error:')) {
			if (this._onErrorMsg(textMsg, command))
				return;
		}
		else if (textMsg.startsWith('fontsmissing:')) {
			var fontsMissingObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			var msg = ' ';
			for (var i = 0; i < fontsMissingObj.fontsmissing.length; ++i) {
				if (i > 0)
					msg += ', ';
				msg += fontsMissingObj.fontsmissing[i];
			}

			if (this._map.welcome && !this._map.welcome.isGuest() && this._map.welcome.shouldWelcome() && window.autoShowWelcome)
			{
				setTimeout(function() {
					this._map.uiManager.showInfoModal('fontsmissing', _('Missing Fonts'), msg, null, _('Close'));
				}.bind(this), 60000);
			}
			else
			{
				this._map.uiManager.showInfoModal('fontsmissing', _('Missing Fonts'), msg, null, _('Close'));
			}
		}
		else if (textMsg.startsWith('info:') && command.errorCmd === 'socket') {
			if (command.errorKind === 'limitreached' && !this.WasShownLimitDialog) {
				this.WasShownLimitDialog = true;
				textMsg = errorMessages.limitreached;
				textMsg = textMsg.replace('{docs}', command.params[0]);
				textMsg = textMsg.replace('{connections}', command.params[1]);
				textMsg = textMsg.replace('{productname}', (typeof brandProductName !== 'undefined' ?
					brandProductName : 'Collabora Online Development Edition (unbranded)'));
				this._map.fire('infobar',
					{
						msg: textMsg,
						action: app.util.getProduct(),
						actionLabel: errorMessages.infoandsupport
					});
			}
		}
		else if (textMsg.startsWith('pong ') && this._map._debug.pingOn) {
			this._map._debug.reportPong(command.rendercount);
		}
		else if (textMsg.startsWith('saveas:') || textMsg.startsWith('renamefile:')) {
			this._renameOrSaveAsCallback(textMsg, command);
		}
		else if (textMsg.startsWith('exportas:')) {
			this._exportAsCallback(command);
		}
		else if (textMsg.startsWith('warn:')) {
			var len = 'warn: '.length;
			textMsg = textMsg.substring(len);
			if (textMsg.startsWith('saveas:')) {
				var userName = command.username ? command.username : _('Someone');
				var message = _('{username} saved this document as {filename}. Do you want to join?').replace('{username}', userName).replace('{filename}', command.filename);

				this._map.uiManager.showConfirmModal('save-as-warning', '', message, _('OK'), function() {
					this._renameOrSaveAsCallback(textMsg, command);
				}.bind(this));
			}
		}
		else if (window.ThisIsAMobileApp && textMsg.startsWith('mobile:')) {
			// allow passing some events easily from the mobile app
			var mobileEvent = textMsg.substring('mobile: '.length);
			this._map.fire(mobileEvent);
		}
		else if (textMsg.startsWith('blockui:')) {
			textMsg = textMsg.substring('blockui:'.length).trim();
			msg = null;

			if (textMsg === 'rename') {
				msg = _('The document is being renamed and will reload shortly');
			}
			else if (textMsg === 'switchingtooffline') {
				msg = _('The document is switching to Offline mode and will reload shortly');
			}

			this._map.fire('blockUI', {message: msg});
			return;
		}
		else if (textMsg.startsWith('unblockui:')) {
			this._map.fire('unblockUI');
			return;
		}
		else if (textMsg.startsWith('featurelock: ')) {
			// Handle feature locking related messages
			var lockInfo = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			this._map._setLockProps(lockInfo);
			return;
		}
		else if (textMsg.startsWith('restrictedCommands: ')) {
			// Handle restriction related messages
			var restrictionInfo = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			this._map._setRestrictions(restrictionInfo);
			return;
		}
		else if (textMsg.startsWith('blockedcommand: ')) {
			var blockedInfo = app.socket.parseServerCmd(textMsg.substring(16));
			if (blockedInfo.errorKind === 'restricted')
				window.app.console.log('Restricted command "' + blockedInfo.errorCmd + '" was blocked');
			else if (blockedInfo.errorKind === 'locked')
				this._map.openUnlockPopup(blockedInfo.errorCmd);
			return;
		}
		else if (textMsg.startsWith('updateroutetoken') && window.indirectSocket) {
			window.routeToken = textMsg.split(' ')[1];
			window.app.console.log('updated routeToken: ' + window.routeToken);
		}
		else if (textMsg.startsWith('reload')) {
			// Switching modes.
			window.location.reload(false);
		} else if (textMsg.startsWith('slidelayer:')) {
			if (app.isExperimentalMode()) {
				SlideBitmapManager.handleRenderSlideEvent(e);
			} else {
				const content = JSON.parse(textMsg.substring('slidelayer:'.length + 1));
				this._map.fire('slidelayer', {
					message: content,
					image: e.image
				});
			}
			return;
		} else if (textMsg.startsWith('sliderenderingcomplete:')) {
			if (app.isExperimentalMode()) {
				SlideBitmapManager.handleSlideRenderingComplete(e);
			} else {
				const json = JSON.parse(textMsg.substring('sliderenderingcomplete:'.length + 1));
				this._map.fire('sliderenderingcomplete', {
					success: json.status === 'success'
				});
			}
			return;
		}
		else if (!textMsg.startsWith('tile:') && !textMsg.startsWith('delta:') &&
			     !textMsg.startsWith('renderfont:') && !textMsg.startsWith('slidelayer:') &&
			     !textMsg.startsWith('windowpaint:')) {

			if (imgBytes !== undefined) {
				try {
					// if it's not a tile, parse the whole message
					textMsg = String.fromCharCode.apply(null, imgBytes);
				} catch (error) {
					// big data string
					textMsg = this._utf8ToString(imgBytes);
				}
			}

			// Decode UTF-8 in case it is binary frame. Disable this block
			// in the iOS app as the image data is not URL encoded.
			if (typeof e.data === 'object') {
				// FIXME: Not sure what this code is supposed to do. Doesn't
				// decodeURIComponent() exactly reverse what window.escape() (which
				// is a deprecated equivalent of encodeURIComponent()) does? In what
				// case is this code even hit? If somebody figures out what is going
				// on here, please replace this comment with an explanation.
				textMsg = decodeURIComponent(window.escape(textMsg));
			}
		}

		if (textMsg.startsWith('status:')) {
			this._onStatusMsg(textMsg, JSON.parse(textMsg.replace('status:', '').replace('statusupdate:', '')));
			return;
		}

		// These can arrive very early during the startup, and never again.
		if (textMsg.startsWith('progress:')) {
			var info = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			if (!info)
			{
				window.app.console.error('Missing info in progress: message');
				return;
			}
			info.statusType = info.id;
			info.background = info.type == 'bg';

			if (info.id == 'find' || info.id == 'connect' || info.id == 'ready')
			{
				this._map.showBusy(window.ThisIsAMobileApp? _('Loading...'): _('Connecting...'), true);
				if (info.id == "ready") {
					// We're connected: cancel timer and dialog.
					this.ReconnectCount = 0;
					clearTimeout(this.timer);
				}
			} else if (info.id == 'start' || info.id == 'setvalue')
				this._map.fire('statusindicator', info);

			else if (info.id == 'finish') {
				this._map.fire('statusindicator', info);
				this._map._fireInitComplete('statusindicatorfinish');
				// show shutting down popup after saving is finished
				// if we show the popup just after the shuttingdown message, it will be overwitten by save popup
				if (app.idleHandler._serverRecycling) {
					this._map.showBusy(_('Server is shutting down'), false);
				}
			} else
				window.app.console.error('Unknown progress status ' + info.id);
			return;
		}
		else if (textMsg.startsWith('jsdialog:')) {
			this._onJSDialog(textMsg, e.callback);
		}
		else if (textMsg.startsWith('hyperlinkclicked:')) {
			this._onHyperlinkClickedMsg(textMsg);
		}
		else if (textMsg.startsWith('browsersetting:')) {
			window.prefs._initializeBrowserSetting(textMsg);
		}
		else if (textMsg.startsWith('viewsetting:')) {
			const settingJSON = JSON.parse(textMsg.substring('viewsetting:'.length + 1));
			app.serverConnectionService.onViewSetting(settingJSON);
		}

		if (textMsg.startsWith('downloadas:') || textMsg.startsWith('exportas:')) {
			var postMessageObj = {
				success: true,
				result: 'exportas',
				errorMsg: ''
			};

			this._map.fire('postMessage', {msgId: 'Action_Save_Resp', args: postMessageObj});
			// intentional falltrough
		}

		if (!this._map._docLayer || this._handlingDelayedMessages) {
			this._delayMessage(textMsg);
		} else {
			this._map._docLayer._onMessage(textMsg, e.image);
		}
	}

	_exportAsCallback(command) {
		this._map.hideBusy();
		this._map.uiManager.showInfoModal('exported-success', _('Exported to storage'), _('Successfully exported: ') + decodeURIComponent(command.filename), '', _('OK'));
	}

	_askForDocumentPassword(passwordType, msg) {
		this._map.uiManager.showInputModal('password-popup', '', msg, '', _('OK'), function(data) {
			if (data) {
				this._map._docPassword = data;
				if (window.ThisIsAMobileApp) {
					window.postMobileMessage('loadwithpassword password=' + data);
				}
				this._map.loadDocument();
			} else if (passwordType === 'to-modify') {
				this._map._docPassword = '';
				this._map.loadDocument();
			} else {
				this._map.fire('postMessage', {msgId: 'UI_Cancel_Password'});
				this._map.hideBusy();
			}
		}.bind(this), true /* password input */);
	}

	_showDocumentConflictPopUp() {
		var buttonList = [];
		var callbackList = [];

		buttonList.push({ id: 'cancel-conflict-popup', text: _('Cancel') });
		callbackList.push({ id: 'cancel-conflict-popup', func_: null });

		buttonList.push({ id: 'discard-button', text: _('Discard') });
		buttonList.push({ id: 'overwrite-button', text: _('Overwrite') });

		callbackList.push({id: 'discard-button', func_: function() {
			this.sendMessage('closedocument');
		}.bind(this) });

		callbackList.push({id: 'overwrite-button', func_: function() {
			this.sendMessage('savetostorage force=1'); }.bind(this)
		});

		if (!this._map['wopi'].UserCanNotWriteRelative) {
			buttonList.push({ id: 'save-to-new-file', text: _('Save to new file') });
			callbackList.push({ id: 'save-to-new-file', func_: function() {
				var filename = this._map['wopi'].BaseFileName;
				if (filename) {
					filename = app.LOUtil.generateNewFileName(filename, '_new');
					this._map.saveAs(filename);
				}
			}.bind(this)});
		}

		var title = _('Document has been changed');
		var message = _('Document has been changed in storage. What would you like to do with your unsaved changes?');

		this._map.uiManager.showModalWithCustomButtons('document-conflict-popup', title, message, false, buttonList, callbackList);
	}

	_renameOrSaveAsCallback(textMsg, command) {
		this._map.hideBusy();
		if (command !== undefined && command.url !== undefined && command.url !== '') {
			var url = command.url;

			// setup for loading the new document, and trigger the load
			var docUrl = url.split('?')[0];
			this._map.options.doc = docUrl;
			this._map.options.previousWopiSrc = this._map.options.wopiSrc; // After save-as op, we may connect to another server, then code will think that server has restarted. In this case, we don't want to reload the page (detect the file name is different).
			this._map.options.wopiSrc = docUrl;
			window.wopiSrc = this._map.options.wopiSrc;

			if (textMsg.startsWith('renamefile:')) {
				this._map.uiManager.documentNameInput.showLoadingAnimation();
				this._map.fire('postMessage', {
					msgId: 'File_Rename',
					args: {
						NewName: command.filename
					}
				});
			} else if (textMsg.startsWith('saveas:')) {
				var accessToken = this._getParameterByName(url, 'access_token');
				var accessTokenTtl = this._getParameterByName(url, 'access_token_ttl');
				let noAuthHeader = this._getParameterByName(url, 'no_auth_header');

				if (accessToken !== undefined) {
					if (accessTokenTtl === undefined) {
						accessTokenTtl = 0;
					}
					this._map.options.docParams = { 'access_token': accessToken, 'access_token_ttl': accessTokenTtl };
					if (noAuthHeader == "1" || noAuthHeader == "true") {
						this._map.options.docParams.no_auth_header = noAuthHeader;
					}
				}
				else {
					this._map.options.docParams = {};
				}

				// if this is save-as, we need to load the document with edit permission
				// otherwise the user has to close the doc then re-open it again
				// in order to be able to edit.
				app.setPermission('edit');
				this.close();
				this._map.loadDocument();
				this._map.sendInitUNOCommands();
				this._map.fire('postMessage', {
					msgId: 'Action_Save_Resp',
					args: {
						success: true,
						fileName: decodeURIComponent(command.filename)
					}
				});
			}
		}
		// var name = command.name; - ignored, we get the new name via the wopi's BaseFileName
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
