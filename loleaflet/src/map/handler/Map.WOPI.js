/*
 * L.WOPI contains WOPI related logic
 */

L.Map.WOPI = L.Handler.extend({

	PostMessageOrigin: false,
	DocumentLoadedTime: false,
	HidePrintOption: false,
	HideSaveOption: false,
	HideExportOption: false,

	initialize: function(map) {
		this._map = map;
	},

	addHooks: function() {
		this._map.on('postMessage', this._postMessage, this);
		L.DomEvent.on(window, 'message', this._postMessageListener, this);
	},

	removeHooks: function() {
		this._map.off('postMessage', this._postMessage, this);
		L.DomEvent.off(window, 'message', this._postMessageListener, this);
	},

	_postMessageListener: function(e) {
		if (!window.WOPIPostmessageReady) {
			return;
		}

		var msg = JSON.parse(e.data);
		if (msg.MessageId === 'Get_Views') {
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
