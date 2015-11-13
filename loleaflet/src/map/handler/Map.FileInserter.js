/*
 * L.Map.FileInserter is handling the fileInserter action
 */

L.Map.mergeOptions({
	fileInserter: true
});

L.Map.FileInserter = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._childId = null;
		this._toInsert = {};
		var parser = document.createElement('a');
		var protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
		parser.href = map.options.server;
		this._url = protocol + '//' + parser.hostname + ':' + parser.port + '/insertfile';
	},

	addHooks: function () {
		this._map.on('insertfile', this._onInsertFile, this);
		this._map.on('childid', this._onChildIdMsg, this);
	},

	removeHooks: function () {
		this._map.off('insertfile', this._onInsertFile, this);
		this._map.off('childid', this._onChildIdMsg, this);
	},

	_onInsertFile: function (e) {
		if (!this._childId) {
			L.Socket.sendMessage('getchildid');
			this._toInsert[Date.now()] = e.file;
		}
		else {
			this._sendFile(Date.now(), e.file);
		}
	},

	_onChildIdMsg: function (e) {
		this._childId = e.id;
		for (var name in this._toInsert) {
			this._sendFile(name, this._toInsert[name]);
		}
		this._toInsert = {};
	},

	_sendFile: function (name, file) {
		var url = this._url;
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = function () {
			if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
				L.Socket.sendMessage('insertfile name=' + name + ' type=graphic');
			}
		};
		xmlHttp.open('POST', url, true);
		var formData = new FormData();
		formData.append('name', name);
		formData.append('childid', this._childId);
		formData.append('file', file);
		xmlHttp.send(formData);
	}
});

L.Map.addInitHook('addHandler', 'fileInserter', L.Map.FileInserter);
