/*
 * L.WOPI contains WOPI related logic
 */

/* global title */
L.Map.WOPI = L.Handler.extend({
	// If the CheckFileInfo call fails on server side, we won't have any PostMessageOrigin.
	// So use '*' because we still needs to send 'close' message to the parent frame which
	// wouldn't be possible otherwise.
	PostMessageOrigin: '*',
	DocumentLoadedTime: false,
	HidePrintOption: false,
	HideSaveOption: false,
	HideExportOption: false,
	DisablePrint: false,
	DisableExport: false,
	DisableCopy: false,

	_appLoadedConditions: {
		doclayerinit: false,
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
		this._map.on('doclayerinit', this._postLoaded, this);
		this._map.on('updatepermission', this._postLoaded, this);
		// This indicates that 'viewinfo' message has already arrived
		this._map.on('viewinfo', this._postLoaded, this);

		this._map.on('wopiprops', this._setWopiProps, this);
		L.DomEvent.on(window, 'message', this._postMessageListener, this);
	},

	removeHooks: function() {
		this._map.off('postMessage', this._postMessage, this);

		// init messages
		this._map.off('doclayerinit', this._postLoaded, this);
		this._map.off('updatepermission', this._postLoaded, this);
		this._map.off('viewinfo', this._postLoaded, this);

		this._map.off('wopiprops', this._setWopiProps, this);
		L.DomEvent.off(window, 'message', this._postMessageListener, this);
	},

	_setWopiProps: function(wopiInfo) {
		// Store postmessageorigin property, if it exists
		if (!!wopiInfo['PostMessageOrigin']) {
			this.PostMessageOrigin = wopiInfo['PostMessageOrigin'];
		}

		this.HidePrintOption = !!wopiInfo['HidePrintOption'];
		this.HideSaveOption = !!wopiInfo['HideSaveOption'];
		this.HideExportOption = !!wopiInfo['HideExportOption'];
		this.DisablePrint = !!wopiInfo['DisablePrint'];
		this.DisableExport = !!wopiInfo['DisableExport'];
		this.DisableCopy = !!wopiInfo['DisableCopy'];

		this._map.fire('postMessage', {msgId: 'App_LoadingStatus', args: {Status: 'Frame_Ready'}});
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

		if (e.type === 'doclayerinit') {
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

	_postMessageListener: function(e) {
		if (!window.WOPIPostmessageReady) {
			return;
		}

		var msg = JSON.parse(e.data);
		if (msg.MessageId === 'Set_Settings') {
			if (msg.Values) {
				var alwaysActive = msg.Values.AlwaysActive;
				this._map.options.alwaysActive = !!alwaysActive;
			}
		}
		else if (msg.MessageId === 'Get_Views') {
			var getMembersRespVal = [];
			for (var viewInfoIdx in this._map._viewInfo) {
				getMembersRespVal.push({
					ViewId: viewInfoIdx,
					UserName: this._map._viewInfo[viewInfoIdx].username,
					UserId: this._map._viewInfo[viewInfoIdx].userid,
					Color: this._map._viewInfo[viewInfoIdx].color
				});
			}

			this._postMessage({msgId: 'Get_Views_Resp', args: getMembersRespVal});
		}
		else if (msg.MessageId === 'Close_Session') {
			this._map._socket.sendMessage('closedocument');
		}
		else if (msg.MessageId === 'Action_Save') {
			var dontTerminateEdit = msg.Values && msg.Values['DontTerminateEdit'];
			var dontSaveIfUnmodified = msg.Values && msg.Values['DontSaveIfUnmodified'];

			this._map.save(dontTerminateEdit, dontSaveIfUnmodified);
		}
		else if (msg.MessageId === 'Action_Print') {
			this._map.print();
		}
		else if (msg.MessageId === 'Action_Export') {
			if (msg.Values) {
				var format = msg.Values.Format;
				var filename = title.substr(0, title.lastIndexOf('.')) || title;
				filename = filename === '' ? 'document' : filename;
				this._map.downloadAs(filename + '.' + format, format);
			}
		}
		else if (msg.MessageId === 'Get_Export_Formats') {
			var exportFormatsResp = [];
			for (var idx in this._map._docLayer._exportFormats) {
				exportFormatsResp.push({
					Label: this._map._docLayer._exportFormats[idx].label,
					Format: this._map._docLayer._exportFormats[idx].format
				});
			}

			this._postMessage({msgId: 'Get_Export_Formats_Resp', args: exportFormatsResp});
		}
	},

	_postMessage: function(e) {
		if (!this.enabled) { return; }

		var msgId = e.msgId;
		var values = e.args || {};
		if (!!this.PostMessageOrigin && window.parent !== window.self) {
			var msg = {
				'MessageId': msgId,
				'SendTime': Date.now(),
				'Values': values
			};

			window.parent.postMessage(JSON.stringify(msg), this.PostMessageOrigin);
		}
	}
});

// This handler would only get 'enabled' by map if map.options.wopi = true
L.Map.addInitHook('addHandler', 'wopi', L.Map.WOPI);
