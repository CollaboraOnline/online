/* -*- js-indent-level: 8 -*- */
/*
 * L.WOPI contains WOPI related logic
 */

/* global w2ui _ app */
L.Map.WOPI = L.Handler.extend({
	// If the CheckFileInfo call fails on server side, we won't have any PostMessageOrigin.
	// So use '*' because we still needs to send 'close' message to the parent frame which
	// wouldn't be possible otherwise.
	PostMessageOrigin: window.postmessageOriginExt || '*',
	BaseFileName: '',
	BreadcrumbDocName: '',
	DocumentLoadedTime: false,
	HidePrintOption: false,
	HideSaveOption: false,
	HideExportOption: false,
	HideRepairOption: false,
	HideChangeTrackingControls: false,
	DisablePrint: false,
	DisableExport: false,
	DisableCopy: false,
	DisableInactiveMessages: false,
	DownloadAsPostMessage: false,
	UserCanNotWriteRelative: true,
	EnableInsertRemoteImage: false,
	EnableInsertRemoteLink: false,
	EnableShare: false,
	HideUserList: null,
	CallPythonScriptSource: null,
	SupportsRename: false,
	UserCanRename: false,
	UserCanWrite: false,

	_appLoadedConditions: {
		docloaded: false,
		updatepermission: false,
		viewinfo: false /* Whether view information has already arrived */
	},

	_appLoaded: false,

	initialize: function(map) {
		this._map = map;
	},

	addHooks: function() {
		this._map.on('postMessage', this._postMessage, this);

		// init messages
		this._map.on('docloaded', this._postLoaded, this);
		this._map.on('updatepermission', this._postLoaded, this);
		// This indicates that 'viewinfo' message has already arrived
		this._map.on('viewinfo', this._postLoaded, this);

		this._map.on('wopiprops', this._setWopiProps, this);
		L.DomEvent.on(window, 'message', this._postMessageListener, this);

		this._map.on('updateviewslist', function() { this._postViewsMessage('Views_List'); }, this);

		if (!window.ThisIsAMobileApp) {
			// override the window.open to issue a postMessage, so that
			// it is possible to handle the hyperlink in the integration
			var that = this;
			window.open = function (open) {
				return function (url, name, features) {
					that._map.fire('postMessage', {
						msgId: 'UI_Hyperlink',
						args: {
							Url: url,
							Name: name,
							Features: features
						}
					});
					if (!that._map._disableDefaultAction['UI_Hyperlink'])
						return open.call(window, url, name, features);
					else
						return null;
				};
			}(window.open);
		}
	},

	removeHooks: function() {
		this._map.off('postMessage', this._postMessage, this);

		// init messages
		this._map.off('docloaded', this._postLoaded, this);
		this._map.off('updatepermission', this._postLoaded, this);
		this._map.off('viewinfo', this._postLoaded, this);

		this._map.off('wopiprops', this._setWopiProps, this);
		L.DomEvent.off(window, 'message', this._postMessageListener, this);

		this._map.off('updateviewslist');
	},

	_setWopiProps: function(wopiInfo) {
		var overridenFileInfo = window.checkFileInfoOverride;
		// Store postmessageorigin property, if it exists
		if (wopiInfo['PostMessageOrigin']) {
			this.PostMessageOrigin = wopiInfo['PostMessageOrigin'];
		}

		this.BaseFileName = wopiInfo['BaseFileName'];
		this.BreadcrumbDocName = wopiInfo['BreadcrumbDocName'];
		if (this.BreadcrumbDocName === undefined)
			this.BreadcrumbDocName = this.BaseFileName;
		this.HidePrintOption = !!wopiInfo['HidePrintOption'];
		this.HideSaveOption = !!wopiInfo['HideSaveOption'];
		this.HideExportOption = !!wopiInfo['HideExportOption'];
		this.HideRepairOption = !!wopiInfo['HideRepairOption'];
		this.HideChangeTrackingControls = !!wopiInfo['HideChangeTrackingControls'];
		this.DisablePrint = !!wopiInfo['DisablePrint'];
		this.DisableExport = !!wopiInfo['DisableExport'];
		this.DisableCopy = !!wopiInfo['DisableCopy'];
		this.DisableInactiveMessages = !!wopiInfo['DisableInactiveMessages'];
		this.DownloadAsPostMessage = Object.prototype.hasOwnProperty.call(overridenFileInfo, 'DownloadAsPostMessage') ?
			overridenFileInfo.DownloadAsPostMessage : !!wopiInfo['DownloadAsPostMessage'];
		this.UserCanNotWriteRelative = !!wopiInfo['UserCanNotWriteRelative'];
		this.EnableInsertRemoteImage = !!wopiInfo['EnableInsertRemoteImage'];
		this.EnableRemoteLinkPicker = !!wopiInfo['EnableRemoteLinkPicker'];
		this.SupportsRename = !!wopiInfo['SupportsRename'];
		this.UserCanRename = !!wopiInfo['UserCanRename'];
		this.EnableShare = !!wopiInfo['EnableShare'];
		this.UserCanWrite = !!wopiInfo['UserCanWrite'];
		if (this.UserCanWrite) // There are 2 places that set the file permissions, WOPI and URI. Don't change permission if URI doesn't allow.
			app.file.permission = (app.file.permission === 'edit' ? 'edit': app.file.permission);
		else
			app.file.permission = 'readonly';
		this.IsOwner = !!wopiInfo['IsOwner'];

		if (wopiInfo['HideUserList'])
			this.HideUserList = wopiInfo['HideUserList'].split(',');

		this._map.fire('postMessage', {
			msgId: 'App_LoadingStatus',
			args: {
				Status: 'Frame_Ready',
				Features: {
					VersionStates: true
				}
			}
		});

		if ('TemplateSaveAs' in wopiInfo) {
			this._map.showBusy(_('Creating new file from template...'), false);
			this._map.saveAs(wopiInfo['TemplateSaveAs']);
		}
	},

	resetAppLoaded: function() {
		this._appLoaded = false;
		for (var key in this._appLoadedConditions) {
			this._appLoadedConditions[key] = false;
		}
	},

	_postLoaded: function(e) {
		if (this._appLoaded) {
			return;
		}

		if (e.type === 'docloaded') {
			// doc unloaded
			if (!e.status)
			{
				this._appLoadedConditions[e.type] = false;
				return;
			}

			this.DocumentLoadedTime = Date.now();
		}
		this._appLoadedConditions[e.type] = true;
		for (var key in this._appLoadedConditions) {
			if (!this._appLoadedConditions[key])
				return;
		}

		this._appLoaded = true;
		this._map.fire('postMessage', {msgId: 'App_LoadingStatus', args: {Status: 'Document_Loaded', DocumentLoadedTime: this.DocumentLoadedTime}});
	},

	// Naturally we set a CSP to catch badness, but check here as well.
	// Checking whether a message came from our iframe's parents is
	// un-necessarily difficult.
	_allowMessageOrigin: function(e) {
		// cache - to avoid regexps.
		if (this._cachedGoodOrigin && this._cachedGoodOrigin === e.origin)
			return true;

		// e.origin === 'null' when sandboxed (i.e. when the parent is a file on local filesystem).
		if (e.origin === 'null')
			return true;
		try {
			if (e.origin === window.parent.origin)
				return true;
		} catch (secErr) { // security error de-referencing window.parent.origin.
		}

		// sent from the server
		var i;
		if (!this._allowedOrigins && window.frameAncestors)
		{
			var ancestors = window.frameAncestors.trim().split(' ');
			this._allowedOrigins = ancestors;
			// convert to JS regexps from localhost:* to https*://localhost:.*
			for (i = 0; i < ancestors.length; i++) {
				this._allowedOrigins[i] = '(http|https)://' + ancestors[i].replace(/:\*/, ':?.*');
			}
		}

		if (this._allowedOrigins)
		{
			for (i = 0; i < this._allowedOrigins.length; i++) {
				if (e.origin.match(this._allowedOrigins[i]))
				{
					this._cachedGoodOrigin = e.origin;
					return true;
				}
			}
		}

		// chrome only
		if (window.location.ancestorOrigins &&
		    window.location.ancestorOrigins.contains(e.origin))
		{
			this._cachedGoodOrigin = e.origin;
			return true;
		}

		return false;
	},

	_postMessageListener: function(e) {
		if (!this._allowMessageOrigin(e))
			return;

		var msg;

		if (('data' in e) && Object.hasOwnProperty.call(e.data, 'MessageId')) {
			// when e.data already contains the right props, but isn't JSON (a blob is passed for ex)
			msg = e.data;
		} else {
			try {
				msg = JSON.parse(e.data);
			} catch (e) {
				window.app.console.error(e);
				return;
			}
		}

		// allow closing documents before they are completely loaded
		if (msg.MessageId === 'Close_Session') {
			app.socket.sendMessage('closedocument');
			return;
		}

		// Exception: UI modification can be done before WOPIPostmessageReady was fullfiled
		if (msg.MessageId === 'Show_Button' || msg.MessageId === 'Hide_Button' || msg.MessageId === 'Remove_Button') {
			if (!msg.Values) {
				window.app.console.error('Property "Values" not set');
				return;
			}

			if (!msg.Values.id) {
				window.app.console.error('Property "Values.id" not set');
				return;
			}
			var show = msg.MessageId === 'Show_Button';
			this._map.uiManager.showButton(msg.Values.id, show);
		}
		else if (msg.MessageId === 'Remove_Statusbar_Element') {
			if (!msg.Values) {
				window.app.console.error('Property "Values" not set');
				return;
			}
			if (!msg.Values.id) {
				window.app.console.error('Property "Values.id" not set');
				return;
			}
			if (!w2ui['actionbar'].get(msg.Values.id)) {
				window.app.console.error('Statusbar element with id "' + msg.Values.id + '" not found.');
				return;
			}
			w2ui['actionbar'].remove(msg.Values.id);
		}
		else if (msg.MessageId === 'Show_Menubar') {
			this._map.uiManager.showMenubar();
		}
		else if (msg.MessageId === 'Hide_Menubar') {
			this._map.uiManager.hideMenubar();
		}
		else if (msg.MessageId === 'Show_Ruler') {
			this._map.uiManager.showRuler();
		}
		else if (msg.MessageId === 'Hide_Ruler') {
			this._map.uiManager.hideRuler();
		}
		else if (msg.MessageId === 'Show_Menu_Item' || msg.MessageId === 'Hide_Menu_Item') {
			if (!msg.Values) {
				window.app.console.error('Property "Values" not set');
				return;
			}
			if (!msg.Values.id) {
				window.app.console.error('Property "Values.id" not set');
				return;
			}
			if (!this._map.menubar || !this._map.menubar.hasItem(msg.Values.id)) {
				window.app.console.error('Menu item with id "' + msg.Values.id + '" not found.');
				return;
			}

			if (msg.MessageId === 'Show_Menu_Item') {
				this._map.menubar.showItem(msg.Values.id);
			} else {
				this._map.menubar.hideItem(msg.Values.id);
			}
		}
		else if (msg.MessageId === 'Insert_Button' &&
			msg.Values && msg.Values.id && msg.Values.imgurl) {
			this._map.uiManager.insertButton(msg.Values);
		} else if (msg.MessageId === 'Send_UNO_Command' && msg.Values && msg.Values.Command) {
			this._map.sendUnoCommand(msg.Values.Command, msg.Values.Args || '');
		}
		else if (msg.MessageId === 'Disable_Default_UIAction') {
			// Disable the default handler and action for a UI command.
			// When set to true, the given UI command will issue a postmessage
			// only. For example, UI_Save will be issued for invoking the save
			// command (from the menu, toolbar, or keyboard shortcut) and no
			// action will take place if 'UI_Save' is disabled via
			// the Disable_Default_UIAction command.
			if (msg.Values && msg.Values.action && msg.Values.disable !== undefined) {
				this._map._disableDefaultAction[msg.Values.action] = msg.Values.disable;
			}
		}

		// All following actions must be done after initialization is completed.
		if (!window.WOPIPostmessageReady) {
			return;
		}

		if (msg.MessageId === 'Host_PostmessageReady') {
			// We already have a listener for this in cool.html, so ignore it here
			return;
		}

		if (msg.MessageId === 'Grab_Focus') {
			app.idleHandler._activate();
			return;
		}

		// allow closing documents before they are completely loaded
		if (msg.MessageId === 'Close_Session') {
			app.socket.sendMessage('closedocument');
			return;
		}

		// For all other messages, warn if trying to interact before we are completely loaded
		if (!this._appLoaded) {
			window.app.console.error('Collabora Online not loaded yet. Listen for App_LoadingStatus (Document_Loaded) event before using PostMessage API. Ignoring post message \'' + msg.MessageId + '\'.');
			return;
		}

		if (msg.MessageId === 'Set_Settings') {
			if (msg.Values) {
				var alwaysActive = msg.Values.AlwaysActive;
				this._map.options.alwaysActive = !!alwaysActive;
			}
		}
		else if (msg.MessageId === 'Get_Views') {
			this._postViewsMessage('Get_Views_Resp');
		}
		else if (msg.MessageId === 'Reset_Access_Token') {
			app.socket.sendMessage('resetaccesstoken ' + msg.Values.token);
		}
		else if (msg.MessageId === 'Action_Save') {
			var dontTerminateEdit = msg.Values && msg.Values['DontTerminateEdit'];
			var dontSaveIfUnmodified = msg.Values && msg.Values['DontSaveIfUnmodified'];
			var extendedData = msg.Values && msg.Values['ExtendedData'];
			extendedData = encodeURIComponent(extendedData);
			this._notifySave = msg.Values && msg.Values['Notify'];

			this._map.save(dontTerminateEdit, dontSaveIfUnmodified, extendedData);
		}
		else if (msg.MessageId === 'Action_Close') {
			this._map.remove();
		}
		else if (msg.MessageId === 'Action_Print') {
			this._map.print();
		}
		else if (msg.MessageId === 'Action_Export') {
			if (msg.Values) {
				var format = msg.Values.Format;
				var fileName = this._map['wopi'].BaseFileName;
				fileName = fileName.substr(0, fileName.lastIndexOf('.'));
				fileName = fileName === '' ? 'document' : fileName;
				this._map.downloadAs(fileName + '.' + format, format);
			}
		}
		else if (msg.MessageId == 'Action_InsertGraphic') {
			if (msg.Values) {
				this._map.insertURL(msg.Values.url);
			}
		}
		else if (msg.MessageId == 'Action_InsertLink') {
			if (msg.Values) {
				var link = this._map.makeURLFromStr(msg.Values.url);
				var text = this._map.getTextForLink();

				text = text ? text.trim() : link;

				var command = {
					'Hyperlink.Text': {
						type: 'string',
						value: text
					},
					'Hyperlink.URL': {
						type: 'string',
						value: link
					}
				};
				this._map.sendUnoCommand('.uno:SetHyperlink', command);
				this._map.focus();
			}
		}
		else if (msg.MessageId == 'Action_GetLinkPreview_Resp') {
			var preview = document.querySelector('#hyperlink-pop-up-preview');
			if (preview) {
				// check if this is a preview for currently displayed link
				if (preview.nextSibling && preview.nextSibling.innerText !== msg.Values.url)
					return;

				preview.innerText = '';
				if (msg.Values.image && msg.Values.image.indexOf('data:') === 0) {
					var image = L.DomUtil.create('img', '', preview);
					image.src = msg.Values.image;
				}
				if (msg.Values.title) {
					var title = L.DomUtil.create('p', '', preview);
					title.innerText = msg.Values.title;
				}
			}
		}
		else if (msg.MessageId === 'Action_InsertFile') {
			if (msg.Values && (msg.Values.File instanceof Blob)) {
				this._map.fire('insertfile', {file: msg.Values.File});
			}
		}
		else if (msg.MessageId == 'Action_Paste') {
			if (msg.Values && msg.Values.Mimetype && msg.Values.Data) {
				var blob = new Blob(['paste mimetype=' + msg.Values.Mimetype + '\n', msg.Values.Data]);
				app.socket.sendMessage(blob);
			}
		}
		else if (msg.MessageId === 'Action_ShowBusy') {
			if (msg.Values && msg.Values.Label) {
				this._map.fire('showbusy', {label: msg.Values.Label});
			}
		}
		else if (msg.MessageId === 'Action_HideBusy') {
			this._map.fire('hidebusy');
		}
		else if (msg.MessageId === 'Get_Export_Formats') {
			var exportFormatsResp = [];
			for (var index in this._map._docLayer._exportFormats) {
				exportFormatsResp.push({
					Label: this._map._docLayer._exportFormats[index].label,
					Format: this._map._docLayer._exportFormats[index].format
				});
			}

			this._postMessage({msgId: 'Get_Export_Formats_Resp', args: exportFormatsResp});
		}
		else if (msg.MessageId === 'Action_SaveAs') {
			if (msg.Values) {
				if (msg.Values.Filename !== null && msg.Values.Filename !== undefined) {
					this._notifySave = msg.Values['Notify'];
					var nameParts = msg.Values.Filename.split('.');
					var format = undefined;
					if (nameParts.length > 1)
						format = nameParts.pop();
					else {
						this._map.uiManager.showInfoModal('error', _('Error'), _('File name should contain an extension.'), '', _('OK'));
						return;
					}

					var isExport = format === 'pdf' || format === 'epub';
					if (isExport) {
						this._map.exportAs(msg.Values.Filename);
					} else {
						this._map.showBusy(_('Creating copy...'), false);
						this._map.saveAs(msg.Values.Filename, format);
					}
				}
			}
		}
		else if (msg.MessageId === 'Action_FollowUser') {
			if (msg.Values) {
				this._map._setFollowing(msg.Values.Follow, msg.Values.ViewId);
			}
			else {
				this._map._setFollowing(true, null);
			}
		}
		else if (msg.MessageId === 'Host_VersionRestore') {
			if (msg.Values.Status === 'Pre_Restore') {
				app.socket.sendMessage('versionrestore prerestore');
			}
		}
		else if (msg.MessageId === 'CallPythonScript' &&
			 Object.prototype.hasOwnProperty.call(msg, 'ScriptFile') &&
			 Object.prototype.hasOwnProperty.call(msg, 'Function')) {
			this._map.CallPythonScriptSource = e.source;
			this._map.sendUnoCommand('vnd.sun.star.script:' + msg.ScriptFile + '$' + msg.Function + '?language=Python&location=share', msg.Values);
		}
		else if (msg.MessageId === 'Action_RemoveView') {
			if (msg.Values && msg.Values.ViewId !== null && msg.Values.ViewId !== undefined) {
				app.socket.sendMessage('removesession ' + msg.Values.ViewId);
			}
		}
		else if (msg.MessageId === 'Action_ChangeUIMode') {
			this._map.uiManager.onChangeUIMode({mode: msg.Values.Mode, force: true});
		}
		else if (msg.MessageId === 'Action_Mention') {
			var list = msg.Values.list;
			this._map.fire('openmentionpopup', {data: list});
		}
	},

	_postMessage: function(e) {
		if (!this.enabled) { return; }
		var msgId = e.msgId;
		var values = e.args || {};
		if (!!this.PostMessageOrigin && window.parent !== window.self) {
			// Filter out unwanted save request response
			if (msgId === 'Action_Save_Resp') {
				if (!this._notifySave)
					return;

				this._notifySave = false;
			}

			var msg = {
				'MessageId': msgId,
				'SendTime': Date.now(),
				'Values': values
			};
			window.parent.postMessage(JSON.stringify(msg), this.PostMessageOrigin);
		}
	},

	_postViewsMessage: function(messageId) {
		var getMembersRespVal = [];
		for (var viewInfoIdx in this._map._viewInfo) {
			getMembersRespVal.push({
				ViewId: viewInfoIdx,
				UserName: this._map._viewInfo[viewInfoIdx].username,
				UserId: this._map._viewInfo[viewInfoIdx].userid,
				UserExtraInfo: this._map._viewInfo[viewInfoIdx].userextrainfo,
				Color: this._map._viewInfo[viewInfoIdx].color,
				ReadOnly: this._map._viewInfo[viewInfoIdx].readonly,
				IsCurrentView: this._map._docLayer._viewId === parseInt(viewInfoIdx, 10)
			});
		}

		this._postMessage({msgId: messageId, args: getMembersRespVal});
	}
});

// This handler would only get 'enabled' by map if map.options.wopi = true
L.Map.addInitHook('addHandler', 'wopi', L.Map.WOPI);
