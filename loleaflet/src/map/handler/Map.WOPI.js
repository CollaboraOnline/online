/* -*- js-indent-level: 8 -*- */
/*
 * L.WOPI contains WOPI related logic
 */

/* global $ w2ui toolbarUpMobileItems _ */
L.Map.WOPI = L.Handler.extend({
	// If the CheckFileInfo call fails on server side, we won't have any PostMessageOrigin.
	// So use '*' because we still needs to send 'close' message to the parent frame which
	// wouldn't be possible otherwise.
	PostMessageOrigin: '*',
	BaseFileName: '',
	DocumentLoadedTime: false,
	HidePrintOption: false,
	HideSaveOption: false,
	HideExportOption: false,
	HideChangeTrackingControls: false,
	DisablePrint: false,
	DisableExport: false,
	DisableCopy: false,
	DisableInactiveMessages: false,
	DownloadAsPostMessage: false,
	UserCanNotWriteRelative: true,
	EnableInsertRemoteImage: false,
	EnableShare: false,
	HideUserList: null,
	CallPythonScriptSource: null,
	SupportsRename: false,
	UserCanRename: false,

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
		// Store postmessageorigin property, if it exists
		if (wopiInfo['PostMessageOrigin']) {
			this.PostMessageOrigin = wopiInfo['PostMessageOrigin'];
		}

		this.BaseFileName = wopiInfo['BaseFileName'];
		this.HidePrintOption = !!wopiInfo['HidePrintOption'];
		this.HideSaveOption = !!wopiInfo['HideSaveOption'];
		this.HideExportOption = !!wopiInfo['HideExportOption'];
		this.HideChangeTrackingControls = !!wopiInfo['HideChangeTrackingControls'];
		this.DisablePrint = !!wopiInfo['DisablePrint'];
		this.DisableExport = !!wopiInfo['DisableExport'];
		this.DisableCopy = !!wopiInfo['DisableCopy'];
		this.DisableInactiveMessages = !!wopiInfo['DisableInactiveMessages'];
		this.DownloadAsPostMessage = !!wopiInfo['DownloadAsPostMessage'];
		this.UserCanNotWriteRelative = !!wopiInfo['UserCanNotWriteRelative'];
		this.EnableInsertRemoteImage = !!wopiInfo['EnableInsertRemoteImage'];
		this.SupportsRename = !!wopiInfo['SupportsRename'];
		this.UserCanRename = !!wopiInfo['UserCanRename'];
		this.EnableShare = !!wopiInfo['EnableShare'];
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
				this._allowedOrigins[i] = 'https*://' + ancestors[i].replace(/:\*/, ':.*');
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
		try {
			msg = JSON.parse(e.data);
		} catch (e) {
			console.error(e);
			return;
		}

		// allow closing documents before they are completely loaded
		if (msg.MessageId === 'Close_Session') {
			this._map._socket.sendMessage('closedocument');
			return;
		}

		// Exception: UI modification can be done before WOPIPostmessageReady was fullfiled
		if (msg.MessageId === 'Show_Button' || msg.MessageId === 'Hide_Button' || msg.MessageId === 'Remove_Button') {
			if (!msg.Values) {
				console.error('Property "Values" not set');
				return;
			}
			if (!msg.Values.id) {
				console.error('Property "Values.id" not set');
				return;
			}
			var toolbar = w2ui['toolbar-up'] ? w2ui['toolbar-up'] : (w2ui['actionbar'] ? w2ui['actionbar'] : w2ui['editbar']);
			if (!toolbar || !toolbar.get(msg.Values.id)) {
				console.error('Toolbar button with id "' + msg.Values.id + '" not found.');
				return;
			}
			if (msg.MessageId === 'Show_Button') {
				toolbar.show(msg.Values.id);
			} else {
				toolbar.hide(msg.Values.id);
			}
		}
		else if (msg.MessageId === 'Remove_Statusbar_Element') {
			if (!msg.Values) {
				console.error('Property "Values" not set');
				return;
			}
			if (!msg.Values.id) {
				console.error('Property "Values.id" not set');
				return;
			}
			if (!w2ui['actionbar'].get(msg.Values.id)) {
				console.error('Statusbar element with id "' + msg.Values.id + '" not found.');
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
				console.error('Property "Values" not set');
				return;
			}
			if (!msg.Values.id) {
				console.error('Property "Values.id" not set');
				return;
			}
			if (!this._map.menubar || !this._map.menubar.hasItem(msg.Values.id)) {
				console.error('Menu item with id "' + msg.Values.id + '" not found.');
				return;
			}

			if (msg.MessageId === 'Show_Menu_Item') {
				this._map.menubar.showItem(msg.Values.id);
			} else {
				this._map.menubar.hideItem(msg.Values.id);
			}
		}
		else if (msg.MessageId === 'Insert_Button') {
			if (msg.Values) {
				if (msg.Values.id && !w2ui['editbar'].get(msg.Values.id)
				    && msg.Values.imgurl) {
					if (this._map._permission === 'edit') {
						// add the css rule for the image
						var style = $('html > head > style');
						if (style.length == 0)
							$('html > head').append('<style/>');
						$('html > head > style').append('.w2ui-icon.' + msg.Values.id + '{background: url(' + msg.Values.imgurl + ') no-repeat center !important; }');

						// Position: Either specified by the caller, or defaulting to first position (before save)
						var insertBefore = msg.Values.insertBefore || 'save';
						// add the item to the toolbar
						w2ui['editbar'].insert(insertBefore, [
							{
								type: 'button',
								uno: msg.Values.unoCommand,
								id: msg.Values.id,
								img: msg.Values.id,
								hint: _(msg.Values.hint), /* "Try" to localize ! */
								/* Notify the host back when button is clicked (only when unoCommand is not set) */
								postmessage: !msg.Values.hasOwnProperty('unoCommand')
							}
						]);
						if (msg.Values.mobile)
						{
							// Add to our list of items to preserve when in mobile mode
							// FIXME: Wrap the toolbar in a class so that we don't make use
							// global variables and functions like this
							var idx = toolbarUpMobileItems.indexOf(insertBefore);
							toolbarUpMobileItems.splice(idx, 0, msg.Values.id);
						}
					}
					else if (this._map._permission === 'readonly') {
						// Just add a menu entry for it
						this._map.fire('addmenu', {id: msg.Values.id, label: msg.Values.hint});
					}
				}
			}
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
			// We already have a listener for this in loleaflet.html, so ignore it here
			return;
		}

		if (msg.MessageId === 'Grab_Focus') {
			this._map.makeActive();
			return;
		}

		// allow closing documents before they are completely loaded
		if (msg.MessageId === 'Close_Session') {
			this._map._socket.sendMessage('closedocument');
			return;
		}

		// For all other messages, warn if trying to interact before we are completely loaded
		if (!this._appLoaded) {
			console.error('LibreOffice Online not loaded yet. Listen for App_LoadingStatus (Document_Loaded) event before using PostMessage API. Ignoring post message \'' + msg.MessageId + '\'.');
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
					this._map.showBusy(_('Creating copy...'), false);
					this._map.saveAs(msg.Values.Filename);
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
				this._map._socket.sendMessage('versionrestore prerestore');
			}
		}
		else if (msg.MessageId === 'CallPythonScript' &&
			 msg.hasOwnProperty('ScriptFile') &&
			 msg.hasOwnProperty('Function')) {
			this._map.CallPythonScriptSource = e.source;
			this._map.sendUnoCommand('vnd.sun.star.script:' + msg.ScriptFile + '$' + msg.Function + '?language=Python&location=share', msg.Values);
		}
		else if (msg.MessageId === 'Action_RemoveView') {
			if (msg.Values && msg.Values.ViewId !== null && msg.Values.ViewId !== undefined) {
				this._map._socket.sendMessage('removesession ' + msg.Values.ViewId);
			}
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
