/*
 * L.Socket contains methods for the communication with the server
 */

L.Socket = {
	ProtocolVersionNumber: '0.1',

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
	},

	close: function () {
		this.socket.onerror = function () {};
		this.socket.onclose = function () {};
		this.socket.onmessage = function () {};
		this.socket.close();
	},

	sendMessage: function (msg, coords) {
		var socketState = this.socket.readyState;
		if (socketState === 2 || socketState === 3) {
			this.connect(this._map);
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
		// Always send the protocol version number.
		// TODO: Move the version number somewhere sensible.
		this.socket.send('loolclient ' + this.ProtocolVersionNumber);

		var msg = 'load url=' + this._map.options.doc;
		if (this._map._docLayer) {
			// we are reconnecting after a lost connection
			msg += ' part=' + this._map.getCurrentPartNumber();
			this._map.fire('statusindicator', {statusType : 'reconnected'});
		}
		if (this._map.options.timestamp) {
			msg += ' timestamp=' + this._map.options.timestamp;
		}
		if (this._map.options.renderingOptions) {
			var options = {
				'rendering': this._map.options.renderingOptions
			};
			msg += ' options=' + JSON.stringify(options);
		}
		this.socket.send(msg);
		this.socket.send('status');
		this.socket.send('partpagerectangles');
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

		if (textMsg.startsWith('loolserver ')) {
			// This must be the first message.
			if (this._map._docLayer) {
				this.fire('error', {msg: 'Unexpected loolserver message.'});
			}
			// TODO: For now we expect perfect match.
			if (textMsg.substring(11) !== this.ProtocolVersionNumber) {
				this.fire('error', {msg: 'Unsupported server version.'});
			}
		}
		else if (!textMsg.startsWith('tile:') && !textMsg.startsWith('renderfont:')) {
			// log the tile msg separately as we need the tile coordinates
			L.Log.log(textMsg, L.INCOMING);
			if (imgBytes !== undefined) {
				// if it's not a tile, parse the whole message
				textMsg = String.fromCharCode.apply(null, imgBytes);
			}
			// Decode UTF-8.
			textMsg = decodeURIComponent(window.escape(textMsg));
		}
		else {
			var data = imgBytes.subarray(index + 1);
			// read the tile data
			var strBytes = '';
			for (var i = 0; i < data.length; i++) {
				strBytes += String.fromCharCode(data[i]);
			}
			var img = 'data:image/png;base64,' + window.btoa(strBytes);
		}

		if (textMsg.startsWith('status:') && !this._map._docLayer) {
			// first status message, we need to create the document layer
			var tileWidthTwips = this._map.options.tileWidthTwips;
			var tileHeightTwips = this._map.options.tileHeightTwips;
			if (this._map.options.zoom !== this._map.options.defaultZoom) {
				var scale = this._map.options.crs.scale(this._map.options.defaultZoom - this._map.options.zoom);
				tileWidthTwips = Math.round(tileWidthTwips * scale);
				tileHeightTwips = Math.round(tileHeightTwips * scale);
			}

			var command = this.parseServerCmd(textMsg);
			var docLayer = null;
			if (command.type === 'text') {
				docLayer = new L.WriterTileLayer('', {
					permission: this._map.options.permission,
					tileWidthTwips: tileWidthTwips,
					tileHeightTwips: tileHeightTwips,
					docType: command.type
				});
			}
			else if (command.type === 'spreadsheet') {
				docLayer = new L.CalcTileLayer('', {
					permission: this._map.options.permission,
					tileWidthTwips: tileWidthTwips,
					tileHeightTwips: tileHeightTwips,
					docType: command.type
				});
			}
			else {
				if (command.type === 'presentation' &&
						this._map.options.defaultZoom === this._map.options.zoom) {
					// If we have a presentation document and the zoom level has not been set
					// in the options, resize the document so that it fits the viewing area
					var verticalTiles = this._map.getSize().y / 256;
					tileWidthTwips = Math.round(command.height / verticalTiles);
					tileHeightTwips = Math.round(command.height / verticalTiles);
				}
				docLayer = new L.ImpressTileLayer('', {
					permission: this._map.options.permission,
					tileWidthTwips: tileWidthTwips,
					tileHeightTwips: tileHeightTwips,
					docType: command.type
				});
			}

			this._map._docLayer = docLayer;
			this._map.addLayer(docLayer);
		}
		if (this._map._docLayer) {
			this._map._docLayer._onMessage(textMsg, img);
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
			else if (tokens[i].substring(0, 5) === 'jail=') {
				command.jail = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 4) === 'dir=') {
				command.dir = tokens[i].substring(4);
			}
			else if (tokens[i].substring(0, 5) === 'name=') {
				command.name = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'port=') {
				command.port = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'font=') {
				command.font = window.decodeURIComponent(tokens[i].substring(5));
			}
		}
		if (command.tileWidth && command.tileHeight && this._map._docLayer) {
			var defaultZoom = this._map.options.zoom;
			var scale = command.tileWidth / this._map._docLayer.options.tileWidthTwips;
			// scale = 1.2 ^ (defaultZoom - zoom)
			// zoom = defaultZoom -log(scale) / log(1.2)
			command.zoom = Math.round(defaultZoom - Math.log(scale) / Math.log(1.2));
		}
		return command;
	}
};

if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}
