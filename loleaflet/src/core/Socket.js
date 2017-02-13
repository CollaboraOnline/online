/*
 * L.Socket contains methods for the communication with the server
 */

/* global _ vex $ errorMessages */
L.Socket = L.Class.extend({
	ProtocolVersionNumber: '0.1',

	initialize: function (map) {
		this._map = map;
		try {
			if (map.options.permission) {
				map.options.docParams['permission'] = map.options.permission;
			}
			this.socket = new WebSocket(map.options.server + '/lool/' + encodeURIComponent(map.options.doc + '?' + $.param(map.options.docParams)) + '/ws');
			this.socket.onerror = L.bind(this._onSocketError, this);
			this.socket.onclose = L.bind(this._onSocketClose, this);
			this.socket.onopen = L.bind(this._onSocketOpen, this);
			this.socket.onmessage = L.bind(this._onMessage, this);
			this.socket.binaryType = 'arraybuffer';
		} catch (e) {
			this._map.fire('error', {msg: _('Oops, there is a problem connecting to LibreOffice Online : ' + e), cmd: 'socket', kind: 'failed', id: 3});
			return null;
		}
		this._msgQueue = [];
	},

	close: function () {
		this.socket.onerror = function () {};
		this.socket.onclose = function () {};
		this.socket.onmessage = function () {};
		this.socket.close();
	},

	connected: function() {
		return this.socket && this.socket.readyState === 1;
	},

	sendMessage: function (msg, coords) {
		if ((!msg.startsWith('useractive') && !msg.startsWith('userinactive') && !this._map._active) ||
		    this._map._fatal) {
			// Avoid communicating when we're inactive.
			return;
		}

		var socketState = this.socket.readyState;
		if (socketState === 2 || socketState === 3) {
			this.initialize(this._map);
		}

		if (socketState === 1) {
			this.socket.send(msg);
			// Only attempt to log text frames, not binary ones.
			if (typeof msg === 'string') {
				L.Log.log(msg, L.OUTGOING, coords);
				if (this._map._docLayer && this._map._docLayer._debug) {
					console.log(+new Date() + ' %cOUTGOING%c: ' + msg.concat(' ').replace(' ', '%c '), 'background:#fbb;color:black', 'color:red', 'color:black');
				}
			}
		}
		else {
			// push message while trying to connect socket again.
			this._msgQueue.push({msg: msg, coords: coords});
		}
	},

	_doSend: function(msg, coords) {
		// Only attempt to log text frames, not binary ones.
		if (typeof msg === 'string') {
			L.Log.log(msg, L.OUTGOING, coords);
			if (this._map._docLayer && this._map._docLayer._debug) {
				console.log(+new Date() + ' %cOUTGOING%c: ' + msg.concat(' ').replace(' ', '%c '), 'background:#fbb;color:black', 'color:red', 'color:black');
			}
		}

		this.socket.send(msg);
	},

	_onSocketOpen: function () {
		// Always send the protocol version number.
		// TODO: Move the version number somewhere sensible.
		this._doSend('loolclient ' + this.ProtocolVersionNumber);

		var msg = 'load url=' + encodeURIComponent(this._map.options.doc);
		if (this._map._docLayer) {
			this._reconnecting = true;
			// we are reconnecting after a lost connection
			msg += ' part=' + this._map.getCurrentPartNumber();
		}
		if (this._map.options.timestamp) {
			msg += ' timestamp=' + this._map.options.timestamp;
		}
		if (this._map._docPassword) {
			msg += ' password=' + this._map._docPassword;
		}
		if (this._map.options.renderingOptions) {
			var options = {
				'rendering': this._map.options.renderingOptions
			};
			msg += ' options=' + JSON.stringify(options);
		}
		this._doSend(msg);
		this._doSend('partpagerectangles');
		for (var i = 0; i < this._msgQueue.length; i++) {
			this._doSend(this._msgQueue[i].msg, this._msgQueue[i].coords);
		}
		this._msgQueue = [];

		this._map._activate();
	},

	_utf8ToString: function (data) {
		var strBytes = '';
		for (var it = 0; it < data.length; it++) {
			strBytes += String.fromCharCode(data[it]);
		}
		return strBytes;
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

		if (this._map._docLayer && this._map._docLayer._debug) {
			console.log(+new Date() + ' %cINCOMING%c: ' + textMsg.concat(' ').replace(' ', '%c '), 'background:#ddf;color:black', 'color:blue', 'color:black');
		}

		var command = this.parseServerCmd(textMsg);
		if (textMsg.startsWith('loolserver ')) {
			// This must be the first message, unless we reconnect.
			var loolwsdVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			var h = loolwsdVersionObj.Hash;
			if (parseInt(h,16).toString(16) === h.toLowerCase()) {
				h = '<a target="_blank" href="https://gerrit.libreoffice.org/gitweb?p=online.git;a=log;h=' + h + '">' + h + '</a>';
				$('#loolwsd-version').html(loolwsdVersionObj.Version + ' (git hash: ' + h + ')');
			}
			else {
				$('#loolwsd-version').text(loolwsdVersionObj.Version);
			}

			// TODO: For now we expect perfect match in protocol versions
			if (loolwsdVersionObj.Protocol !== this.ProtocolVersionNumber) {
				this._map.fire('error', {msg: _('Unsupported server version.')});
			}
		}
		else if (textMsg.startsWith('lokitversion ')) {
			var lokitVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			var h = lokitVersionObj.BuildId.substring(0, 7);
			if (parseInt(h,16).toString(16) === h.toLowerCase()) {
				h = '<a target="_blank" href="https://gerrit.libreoffice.org/gitweb?p=core.git;a=log;h=' + h + '">' + h + '</a>';
			}
			$('#lokit-version').html(lokitVersionObj.ProductName + ' ' +
			                         lokitVersionObj.ProductVersion + lokitVersionObj.ProductExtension.replace('.10.','-') +
			                         ' (git hash: ' + h + ')');
		}
		else if (textMsg.startsWith('perm:')) {
			var perm = textMsg.substring('perm:'.length);

			// This message is often received very early before doclayer is initialized
			// Change options.permission so that when docLayer is initialized, it
			// picks up the new value of permission rather than something else
			this._map.options.permission = 'readonly';
			// Lets also try to set the permission ourself since this can well be received
			// after doclayer is initialized. There's no harm to call this in any case.
			this._map.setPermission(perm);

			return;
		}
		else if (textMsg.startsWith('wopi: ')) {
			// Handle WOPI related messages
			var wopiInfo = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			this._map.fire('wopiprops', wopiInfo);
			return;
		}
		else if (textMsg.startsWith('close: ')) {
			textMsg = textMsg.substring('close: '.length);
			msg = '';

			// This is due to document owner terminating the session
			if (textMsg === 'ownertermination') {
				msg = _('Session terminated by document owner');
			}
			else if (textMsg === 'shutdown') {
				msg = _('Server shutdown for maintenance');
			}

			// Close any open dialogs first.
			if (vex.dialogID > 0) {
				var id = vex.dialogID;
				vex.dialogID = -1;
				vex.close(id);
			}

			var options = $.extend({}, vex.defaultOptions, {
				contentCSS: {'background':'rgba(0, 0, 0, 0)',
				             'font-size': 'xx-large',
				             'color': '#fff',
				             'text-align': 'center'},
				content: msg
			});
			options.id = vex.globalID;
			vex.dialogID = options.id;
			vex.globalID += 1;
			options.$vex = $('<div>').addClass(vex.baseClassNames.vex).addClass(options.className).css(options.css).data({
				vex: options
			});
			options.$vexOverlay = $('<div>').addClass(vex.baseClassNames.overlay).addClass(options.overlayClassName).css(options.overlayCSS).data({
				vex: options
			});

			options.$vex.append(options.$vexOverlay);

			options.$vexContent = $('<div>').addClass(vex.baseClassNames.content).addClass(options.contentClassName).css(options.contentCSS).text(options.content).data({
				vex: options
			});
			options.$vex.append(options.$vexContent);

			$(options.appendLocation).append(options.$vex);
			vex.setupBodyClassName(options.$vex);

			// Disconnect the websocket manually
			this.close();

			// Tell WOPI host about it which should handle this situation
			this._map.fire('postMessage', {msgId: 'Session_Closed'});
			this._map.remove();

			return;
		}
		else if (textMsg.startsWith('error:') && command.errorCmd === 'storage') {
			if (command.errorKind === 'savediskfull') {
				this._map.fire('error', {msg: errorMessages.storage.savediskfull});
			}
			else if (command.errorKind === 'savefailed') {
				// Just warn the user
				this._map.fire('warn', {msg: errorMessages.storage.savefailed});
			}

			return;
		}
		else if (textMsg.startsWith('error:') && command.errorCmd === 'internal') {
			this._map._fatal = true;
			if (command.errorKind === 'diskfull') {
				this._map.fire('error', {msg: errorMessages.diskfull});
			}
			else if (command.errorKind === 'unauthorized') {
				this._map.fire('error', {msg: errorMessages.unauthorized});
			}

			if (this._map._docLayer) {
				this._map._docLayer.removeAllViews();
			}
			this.close();

			return;
		}
		else if (textMsg.startsWith('error:') && command.errorCmd === 'load') {
			this.close();

			var errorKind = command.errorKind;
			var passwordNeeded = false;
			if (errorKind.startsWith('passwordrequired')) {
				passwordNeeded = true;
				var msg = '';
				var passwordType = errorKind.split(':')[1];
				if (passwordType === 'to-view') {
					msg += _('Document requires password to view.');
				}
				else if (passwordType === 'to-modify') {
					msg += _('Document requires password to modify.');
					msg += ' ';
					msg += _('Hit Cancel to open in view-only mode.');
				}
			} else if (errorKind.startsWith('wrongpassword')) {
				passwordNeeded = true;
				msg = _('Wrong password provided. Please try again.');
			}

			if (passwordNeeded) {
				// Ask the user for password
				vex.dialog.open({
					message: msg,
					input: '<input name="password" type="password" required />',
					callback: L.bind(function(data) {
						if (data) {
							this._map._docPassword = data.password;
							this.initialize(this._map);
						} else if (passwordType === 'to-modify') {
							this._map._docPassword = '';
							this.initialize(this._map);
						} else {
							this._map.hideBusy();
						}
					}, this)
				});
				return;
			}
		}
		else if (textMsg.startsWith('error:') && !this._map._docLayer) {
			textMsg = textMsg.substring(6);
			if (command.errorKind === 'limitreached') {
				this._map._fatal = true;
				textMsg = errorMessages.limitreached;
				textMsg = textMsg.replace(/%0/g, command.params[0]);
				textMsg = textMsg.replace(/%1/g, command.params[1]);
				textMsg = textMsg.replace(/%2/g, (typeof brandProductName !== 'undefined' ? brandProductName : 'LibreOffice Online'));
				textMsg = textMsg.replace(/%3/g, (typeof brandProductFAQURL !== 'undefined' ? brandProductFAQURL : 'https://wiki.documentfoundation.org/Development/LibreOffice_Online'));
			}
			else if (command.errorKind === 'serviceunavailable') {
				this._map._fatal = true;
				textMsg = errorMessages.serviceunavailable;
			}
			this._map.fire('error', {msg: textMsg});
		}
		else if (textMsg.startsWith('pong ') && this._map._docLayer && this._map._docLayer._debug) {
			var times = this._map._docLayer._debugTimePING;
			var timeText = this._map._docLayer._debugSetTimes(times, +new Date() - this._map._docLayer._debugPINGQueue.shift());
			this._map._docLayer._debugData['ping'].setPrefix('Server ping time: ' + timeText +
					'. Rendered tiles: ' + command.rendercount +
					', last: ' + (command.rendercount - this._map._docLayer._debugRenderCount));
			this._map._docLayer._debugRenderCount = command.rendercount;
		}
		else if (textMsg.startsWith('statusindicator:')) {
			//FIXME: We should get statusindicator when saving too, no?
			this._map.showBusy(_('Connecting...'), false);
		}
		else if (!textMsg.startsWith('tile:') && !textMsg.startsWith('renderfont:')) {
			// log the tile msg separately as we need the tile coordinates
			L.Log.log(textMsg, L.INCOMING);
			if (imgBytes !== undefined) {
				try {
					// if it's not a tile, parse the whole message
					textMsg = String.fromCharCode.apply(null, imgBytes);
				} catch (error) {
					// big data string
					textMsg = this._utf8ToString(imgBytes);
				}
			}

			// Decode UTF-8 in case it is binary frame
			if (typeof e.data === 'object') {
				textMsg = decodeURIComponent(window.escape(textMsg));
			}
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
			this._map.fire('doclayerinit');
		} else if (textMsg.startsWith('status:') && this._reconnecting) {
			// we are reconnecting ...
			this._reconnecting = false;
			this._map._docLayer._onMessage('invalidatetiles: EMPTY', null);
			this._map.fire('statusindicator', {statusType: 'reconnected'});
			this._map.setPermission(this._map.options.permission);
		}

		// these can arrive very early during the startup
		if (textMsg.startsWith('statusindicatorstart:')) {
			this._map.fire('statusindicator', {statusType : 'start'});
			return;
		}
		else if (textMsg.startsWith('statusindicatorsetvalue:')) {
			var value = textMsg.match(/\d+/g)[0];
			this._map.fire('statusindicator', {statusType : 'setvalue', value : value});
			return;
		}
		else if (textMsg.startsWith('statusindicatorfinish:')) {
			this._map.fire('statusindicator', {statusType : 'finish'});
			this._map._fireInitComplete('statusindicatorfinish');
			return;
		}

		if (this._map._docLayer) {
			this._map._docLayer._onMessage(textMsg, img);
		}
	},

	_onSocketError: function () {
		this._map.hideBusy();
		// Let onclose (_onSocketClose) report errors.
	},

	_onSocketClose: function (e) {
		var isActive = this._map._active;
		this._map.hideBusy();
		this._map._active = false;

		if (this._map._docLayer) {
			this._map._docLayer.removeAllViews();
		}

		if (isActive) {
			this._map.fire('error', {msg: _('Well, this is embarrassing, we cannot connect to your document. Please try again.'), cmd: 'socket', kind: 'closed', id: 4});
		}

		// Reset wopi's app loaded so that reconnecting again informs outerframe about initialization again
		this._map['wopi'].resetAppLoaded();

		if (!this._reconnecting) {
			this._reconnecting = true;
			this._map._activate();
		}
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
			else if (tokens[i].substring(0, 5) === 'code=') {
				command.errorCode = tokens[i].substring(5);
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
			else if (tokens[i].substring(0, 7) === 'viewid=') {
				command.viewid = tokens[i].substring(7);
			}
			else if (tokens[i].substring(0, 7) === 'params=') {
				command.params = tokens[i].substring(7).split(',');
			}
			else if (tokens[i].substring(0, 9) === 'renderid=') {
				command.renderid = tokens[i].substring(9);
			}
			else if (tokens[i].substring(0, 12) === 'rendercount=') {
				command.rendercount = parseInt(tokens[i].substring(12));
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
});

L.socket = function (map) {
	return new L.Socket(map);
};
