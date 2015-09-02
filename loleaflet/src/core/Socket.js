/*
 * L.Socket contains methods for the communication with the server
 */

L.Socket = {
	connect: function (map) {
		try {
			this.socket = new WebSocket(map.options.server);
		} catch (e) {
			this.fire('error', {msg: 'Socket connection error'});
			return null;
		}
		this._map = map;
		this._msgQueue = [];
		this.socket.onerror = L.bind(this._onSocketError, map);
		this.socket.onclose = L.bind(this._onSocketClose, map);
		this.socket.onopen = L.bind(this._onOpen, this);
		this.socket.onmessage = L.bind(this._onMessage, this);
		this.socket.binaryType = 'arraybuffer';
		return this.socket;
	},

	close: function () {
		this.socket.onerror = function () {};
		this.socket.onclose = function () {};
		this.socket.close();
	},

	sendMessage: function (msg, coords) {
		var socketState = this.socket.readyState;
		if (socketState === 2 || socketState === 3) {
			this._socket = this.connect(this._map);
			this._msgQueue.push({msg: msg, coords: coords});
		}

		if (socketState === 0) {
			// push message while trying to connect socket again.
			this._msgQueue.push({msg: msg, coords: coords});
		}
		else if (socketState === 1) {
			this.socket.send(msg);
			L.Log.log(msg, L.OUTGOING, coords);
		}
	},

	_onOpen: function () {
		var msg = 'load url=' + this._map.options.doc;
		if (this._map._docLayer) {
			msg += ' part=' + this._map.getCurrentPartNumber();
		}
		if (this._map.options.timestamp) {
			msg += ' timestamp=' + this._map.options.timestamp;
		}
		this.socket.send(msg);
		this.socket.send('status');
		this.socket.send('styles');
		for (var i = 0; i < this._msgQueue.length; i++) {
			this.socket.send(this._msgQueue[i].msg);
			L.Log.log(this._msgQueue[i].msg, this._msgQueue[i].coords);
		}
		this._msgQueue = [];
	},

	_onMessage: function (e) {
		var imgBytes, index, textMsg;

		if (typeof (e.data) === 'string') {
			textMsg = e.data;
		}
		else if (typeof (e.data) === 'object') {
			imgBytes = new Uint8Array(e.data);
			index = 0;
			// search for the first newline which marks the end of the message
			while (index < imgBytes.length && imgBytes[index] !== 10) {
				index++;
			}
			textMsg = String.fromCharCode.apply(null, imgBytes.subarray(0, index));
		}

		if (!textMsg.startsWith('tile:')) {
			// log the tile msg separately as we need the tile coordinates
			L.Log.log(textMsg, L.INCOMING);
			if (imgBytes !== undefined) {
				// if it's not a tile, parse the whole message
				textMsg = String.fromCharCode.apply(null, imgBytes);
			}
		}

		if (textMsg.startsWith('status:') && !this._map._docLayer) {
			// first status message, we need to create the document layer
			var command = this.parseServerCmd(textMsg);
			var docLayer = null;
			if (command.type === 'text') {
				docLayer = new L.WriterTileLayer('', {
					edit: this._map.options.edit,
					readOnly: this._map.options.readOnly
				});
			}
			else if (command.type === 'spreadsheet') {
				docLayer = new L.CalcTileLayer('', {
					edit: this._map.options.edit,
					readOnly: this._map.options.readOnly
				});
			}
			else {
				docLayer = new L.ImpressTileLayer('', {
					edit: this._map.options.edit,
					readOnly: this._map.options.readOnly
				});
			}

			this._map._docLayer = docLayer;
			this._map.addLayer(docLayer);
		}
		if (this._map._docLayer) {
			this._map._docLayer._onMessage(textMsg, imgBytes, index);
		}
	},

	_onSocketError: function () {
		this.fire('error', {msg: 'Socket connection error'});
	},

	_onSocketClose: function () {
		this.fire('error', {msg: 'Socket connection closed'});
	},

	parseServerCmd: function (msg) {
		var tokens = msg.split(/[ \n]+/);
		var command = {};
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0, 9) === 'tileposx=') {
				command.x = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 9) === 'tileposy=') {
				command.y = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 2) === 'x=') {
				command.x = parseInt(tokens[i].substring(2));
			}
			else if (tokens[i].substring(0, 2) === 'y=') {
				command.y = parseInt(tokens[i].substring(2));
			}
			else if (tokens[i].substring(0, 10) === 'tilewidth=') {
				command.tileWidth = parseInt(tokens[i].substring(10));
			}
			else if (tokens[i].substring(0, 11) === 'tileheight=') {
				command.tileHeight = parseInt(tokens[i].substring(11));
			}
			else if (tokens[i].substring(0, 6) === 'width=') {
				command.width = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 7) === 'height=') {
				command.height = parseInt(tokens[i].substring(7));
			}
			else if (tokens[i].substring(0, 5) === 'part=') {
				command.part = parseInt(tokens[i].substring(5));
			}
			else if (tokens[i].substring(0, 6) === 'parts=') {
				command.parts = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 8) === 'current=') {
				command.selectedPart = parseInt(tokens[i].substring(8));
			}
			else if (tokens[i].substring(0, 3) === 'id=') {
				// remove newline characters
				command.id = tokens[i].substring(3).replace(/(\r\n|\n|\r)/gm, '');
			}
			else if (tokens[i].substring(0, 5) === 'type=') {
				// remove newline characters
				command.type = tokens[i].substring(5).replace(/(\r\n|\n|\r)/gm, '');
			}
			else if (tokens[i].substring(0, 9) === 'prefetch=') {
				command.preFetch = tokens[i].substring(9);
			}
			else if (tokens[i].substring(0, 4) === 'cmd=') {
				command.errorCmd = tokens[i].substring(4);
			}
			else if (tokens[i].substring(0, 5) === 'kind=') {
				command.errorKind = tokens[i].substring(5);
			}
		}
		if (command.tileWidth && command.tileHeight && this._map._docLayer) {
			var scale = command.tileWidth / this._map._docLayer.options.tileWidthTwips;
			// scale = 1.2 ^ (10 - zoom)
			// zoom = 10 -log(scale) / log(1.2)
			command.zoom = Math.round(10 - Math.log(scale) / Math.log(1.2));
		}
		return command;
	}
};

if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}
